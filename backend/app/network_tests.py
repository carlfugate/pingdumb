import asyncio
import time
import socket
import subprocess
from datetime import datetime
from typing import Dict, Any, Optional
import aiohttp
try:
    import dns.resolver
except ImportError:
    dns = None
from .models import TestConfig, TestResult, TestType

class NetworkTester:
    def __init__(self):
        self.session = None
    
    async def get_session(self):
        if not self.session:
            self.session = aiohttp.ClientSession()
        return self.session
    
    async def run_test(self, config: TestConfig) -> TestResult:
        start_time = time.time()
        
        try:
            if config.test_type == TestType.PING:
                result = await self._ping_test(config)
            elif config.test_type == TestType.HTTP:
                result = await self._http_test(config)
            elif config.test_type == TestType.DNS:
                result = await self._dns_test(config)
            elif config.test_type == TestType.TRACEROUTE:
                result = await self._traceroute_test(config)
            else:
                raise ValueError(f"Unknown test type: {config.test_type}")
            
            response_time = time.time() - start_time
            
            return TestResult(
                config_id=config.id,
                timestamp=datetime.now(),
                success=True,
                response_time=response_time,
                data=result
            )
        
        except Exception as e:
            return TestResult(
                config_id=config.id,
                timestamp=datetime.now(),
                success=False,
                error=str(e),
                response_time=time.time() - start_time
            )
    
    async def _ping_test(self, config: TestConfig) -> Dict[str, Any]:
        # Use system ping command for better compatibility
        proc = await asyncio.create_subprocess_exec(
            'ping', '-c', '1', '-W', str(config.timeout * 1000), config.target,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        
        if proc.returncode == 0:
            output = stdout.decode()
            # Parse ping output for response time
            import re
            match = re.search(r'time=(\d+\.?\d*)', output)
            rtt = float(match.group(1)) if match else None
            return {"rtt": rtt, "output": output}
        else:
            raise Exception(stderr.decode())
    
    async def _http_test(self, config: TestConfig) -> Dict[str, Any]:
        session = await self.get_session()
        timeout = aiohttp.ClientTimeout(total=config.timeout)
        
        async with session.get(config.target, timeout=timeout) as response:
            return {
                "status_code": response.status,
                "headers": dict(response.headers),
                "content_length": len(await response.read())
            }
    
    async def _dns_test(self, config: TestConfig) -> Dict[str, Any]:
        if dns is None:
            raise Exception("dnspython not available")
        
        # Parse target and record type
        record_type = 'A'
        target = config.target
        if ':' in config.target:
            target, record_type = config.target.split(':', 1)
        
        # Get DNS servers to test - check if custom servers specified
        dns_servers = []
        if hasattr(config, 'dns_servers') and config.dns_servers:
            dns_servers = config.dns_servers
        else:
            # Default: local + Google + Cloudflare
            import socket
            try:
                # Get system DNS servers
                with open('/etc/resolv.conf', 'r') as f:
                    for line in f:
                        if line.startswith('nameserver'):
                            server = line.split()[1]
                            if server not in ['127.0.0.1', '::1']:  # Skip localhost
                                dns_servers.append(server)
            except:
                pass
            
            # Add public DNS servers
            dns_servers.extend(['8.8.8.8', '1.1.1.1', '8.8.4.4', '1.0.0.1'])
            # Remove duplicates while preserving order
            dns_servers = list(dict.fromkeys(dns_servers))
        
        results = []
        successful_queries = 0
        total_response_time = 0
        
        for server in dns_servers:
            try:
                resolver = dns.resolver.Resolver()
                resolver.nameservers = [server]
                resolver.timeout = config.timeout
                
                start_time = time.time()
                answers = resolver.resolve(target, record_type)
                query_time = (time.time() - start_time) * 1000  # Convert to ms
                
                result = {
                    "server": server,
                    "success": True,
                    "response_time": query_time,
                    "answers": [str(answer) for answer in answers],
                    "record_type": record_type
                }
                results.append(result)
                successful_queries += 1
                total_response_time += query_time
                
            except Exception as e:
                results.append({
                    "server": server,
                    "success": False,
                    "error": str(e),
                    "record_type": record_type
                })
        
        # Calculate summary statistics
        avg_response_time = total_response_time / successful_queries if successful_queries > 0 else 0
        success_rate = (successful_queries / len(dns_servers)) * 100 if dns_servers else 0
        
        return {
            "record_type": record_type,
            "target": target,
            "servers_tested": len(dns_servers),
            "successful_queries": successful_queries,
            "success_rate": success_rate,
            "avg_response_time": avg_response_time,
            "results": results,
            "summary": {
                "fastest_server": min([r for r in results if r.get("success")], 
                                    key=lambda x: x.get("response_time", float('inf')), 
                                    default={}).get("server"),
                "slowest_server": max([r for r in results if r.get("success")], 
                                    key=lambda x: x.get("response_time", 0), 
                                    default={}).get("server")
            }
        }
    
    async def _traceroute_test(self, config: TestConfig) -> Dict[str, Any]:
        proc = await asyncio.create_subprocess_exec(
            'traceroute', '-m', '15', config.target,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        
        if proc.returncode == 0:
            return {"output": stdout.decode()}
        else:
            raise Exception(stderr.decode())

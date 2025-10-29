import asyncio
import time
import socket
import subprocess
import json
import re
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
            elif config.test_type == TestType.SPEEDTEST_OOKLA:
                result = await self.speedtest_ookla()
            elif config.test_type == TestType.SPEEDTEST_FAST:
                result = await self.speedtest_fast()
            elif config.test_type == TestType.IPERF3:
                # Parse target as server:port or just server
                if ':' in config.target:
                    server, port = config.target.split(':', 1)
                    port = int(port)
                else:
                    server = config.target
                    port = 5201
                result = await self.iperf3_test(server, port)
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

    async def speedtest_ookla(self, server_id: Optional[str] = None) -> Dict[str, Any]:
        """Run Ookla Speedtest CLI"""
        try:
            cmd = ['speedtest', '--accept-license', '--accept-gdpr', '--format=json']
            if server_id:
                cmd.extend(['--server-id', server_id])
            
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
            
            if proc.returncode == 0:
                data = json.loads(stdout.decode())
                return {
                    'download_mbps': data['download']['bandwidth'] * 8 / 1000000,
                    'upload_mbps': data['upload']['bandwidth'] * 8 / 1000000,
                    'ping_ms': data['ping']['latency'],
                    'server': data['server']['name'],
                    'server_id': data['server']['id'],
                    'raw_data': data
                }
            else:
                raise Exception(stderr.decode())
        except Exception as e:
            raise Exception(f"Speedtest failed: {str(e)}")

    async def speedtest_fast(self) -> Dict[str, Any]:
        """Run Fast.com speedtest using HTTP approach"""
        try:
            import time
            
            session = await self.get_session()
            
            # Step 1: Get the Fast.com homepage to find JS files
            async with session.get('https://fast.com/') as response:
                html = await response.text()
                
            # Step 2: Extract JS file URLs
            import re
            js_files = re.findall(r'src="([^"]*\.js[^"]*)"', html)
            if not js_files:
                raise Exception("No JavaScript files found on Fast.com")
            
            # Step 3: Get token from the main JS file
            main_js = js_files[0]
            if not main_js.startswith('http'):
                main_js = 'https://fast.com' + main_js
                
            async with session.get(main_js) as js_response:
                if js_response.status != 200:
                    raise Exception(f"Failed to fetch JS file: {js_response.status}")
                js_content = await js_response.text()
            
            # Step 4: Extract token from JS (look for base64-like strings)
            token_match = re.search(r'"([A-Za-z0-9+/]{20,}={0,2})"', js_content)
            if not token_match:
                raise Exception("Could not extract token from JavaScript")
            
            token = token_match.group(1)
            
            # Step 5: Get download URLs from API
            api_url = f'https://api.fast.com/netflix/speedtest/v2?https=true&token={token}&urlCount=3'
            async with session.get(api_url) as response:
                if response.status != 200:
                    raise Exception(f"API request failed with status {response.status}")
                data = await response.json()
            
            if not data or len(data) == 0:
                raise Exception("No download URLs received from API")
            
            # Step 6: Download test files and measure speed
            download_speeds = []
            test_duration = 10  # seconds
            
            for url_info in data[:3]:  # Use first 3 URLs
                url = url_info['url']
                
                start_time = time.time()
                bytes_downloaded = 0
                
                try:
                    async with session.get(url) as response:
                        async for chunk in response.content.iter_chunked(8192):
                            bytes_downloaded += len(chunk)
                            elapsed = time.time() - start_time
                            
                            # Stop after test duration
                            if elapsed >= test_duration:
                                break
                    
                    if elapsed > 0:
                        speed_mbps = (bytes_downloaded * 8) / (elapsed * 1000000)  # Convert to Mbps
                        download_speeds.append(speed_mbps)
                except Exception as e:
                    print(f"Error downloading from {url}: {e}")
                    continue
            
            if not download_speeds:
                raise Exception("No successful speed measurements")
            
            # Calculate average speed
            avg_speed = sum(download_speeds) / len(download_speeds)
            
            return {
                'download_mbps': avg_speed,
                'upload_mbps': 0,  # Fast.com primarily tests download
                'test_duration': test_duration,
                'urls_tested': len(download_speeds),
                'token_used': token[:8] + "..." if len(token) > 8 else token
            }
            
        except Exception as e:
            raise Exception(f"Fast.com test failed: {str(e)}")

    async def iperf3_test(self, server: str, port: int = 5201, duration: int = 10, reverse: bool = False) -> Dict[str, Any]:
        """Run iPerf3 test"""
        try:
            cmd = ['iperf3', '-c', server, '-p', str(port), '-t', str(duration), '-J']
            if reverse:
                cmd.append('-R')
            
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=duration + 30)
            
            if proc.returncode == 0:
                data = json.loads(stdout.decode())
                return {
                    'bandwidth_mbps': data['end']['sum_received']['bits_per_second'] / 1000000,
                    'retransmits': data['end']['sum_sent'].get('retransmits', 0),
                    'jitter_ms': data['end']['sum_received'].get('jitter_ms', 0),
                    'packet_loss': data['end']['sum_received'].get('lost_percent', 0),
                    'direction': 'download' if reverse else 'upload',
                    'raw_data': data
                }
            else:
                raise Exception(stderr.decode())
        except Exception as e:
            raise Exception(f"iPerf3 test failed: {str(e)}")

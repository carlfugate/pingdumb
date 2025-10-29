from dataclasses import dataclass, asdict, field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class TestType(str, Enum):
    PING = "ping"
    HTTP = "http"
    DNS = "dns"
    TRACEROUTE = "traceroute"
    SPEEDTEST_OOKLA = "speedtest_ookla"
    SPEEDTEST_FAST = "speedtest_fast"
    IPERF3 = "iperf3"

@dataclass
class TestConfig:
    name: str
    test_type: TestType
    target: str
    interval: int = 30
    timeout: int = 5
    enabled: bool = True
    id: Optional[str] = None
    created_at: Optional[datetime] = None
    dns_servers: Optional[List[str]] = None  # For DNS tests
    
    def dict(self):
        return asdict(self)

@dataclass
class TestResult:
    config_id: str
    timestamp: datetime
    success: bool
    response_time: Optional[float] = None
    error: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    id: Optional[str] = None
    
    def dict(self):
        result = asdict(self)
        # Convert datetime to string for JSON serialization
        if result['timestamp']:
            result['timestamp'] = result['timestamp'].isoformat()
        return result

import sqlite3
import json
import uuid
from datetime import datetime
from typing import List, Optional
from .models import TestConfig, TestResult

class Database:
    def __init__(self, db_path: str = "network_tests.db"):
        self.db_path = db_path
    
    async def init_db(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS test_configs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                test_type TEXT NOT NULL,
                target TEXT NOT NULL,
                interval INTEGER DEFAULT 30,
                timeout INTEGER DEFAULT 5,
                enabled BOOLEAN DEFAULT 1,
                dns_servers TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS test_results (
                id TEXT PRIMARY KEY,
                config_id TEXT NOT NULL,
                timestamp TIMESTAMP NOT NULL,
                success BOOLEAN NOT NULL,
                response_time REAL,
                error TEXT,
                data TEXT,
                FOREIGN KEY (config_id) REFERENCES test_configs (id)
            )
        ''')
        
        # Create default configs
        cursor.execute("SELECT COUNT(*) FROM test_configs")
        if cursor.fetchone()[0] == 0:
            default_configs = [
                ("Google DNS", "ping", "8.8.8.8"),
                ("Cloudflare DNS", "ping", "1.1.1.1"),
                ("Google HTTP", "http", "https://google.com"),
                ("Local Gateway", "ping", "192.168.1.1"),
            ]
            
            for name, test_type, target in default_configs:
                config_id = str(uuid.uuid4())
                cursor.execute('''
                    INSERT INTO test_configs (id, name, test_type, target)
                    VALUES (?, ?, ?, ?)
                ''', (config_id, name, test_type, target))
        
        conn.commit()
        conn.close()
    
    async def get_configs(self) -> List[TestConfig]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM test_configs ORDER BY created_at")
        rows = cursor.fetchall()
        conn.close()
        
        configs = []
        for row in rows:
            dns_servers = None
            if len(row) > 7 and row[7]:  # dns_servers field exists and has value
                try:
                    dns_servers = json.loads(row[7])
                except:
                    dns_servers = None
                    
            configs.append(TestConfig(
                id=row[0],
                name=row[1],
                test_type=row[2],
                target=row[3],
                interval=row[4],
                timeout=row[5],
                enabled=bool(row[6]),
                dns_servers=dns_servers,
                created_at=datetime.fromisoformat(row[8]) if len(row) > 8 and row[8] else None
            ))
        
        return configs
    
    async def save_config(self, config: TestConfig) -> TestConfig:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        if not config.id:
            config.id = str(uuid.uuid4())
            dns_servers_json = json.dumps(config.dns_servers) if config.dns_servers else None
            cursor.execute('''
                INSERT INTO test_configs (id, name, test_type, target, interval, timeout, enabled, dns_servers)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (config.id, config.name, config.test_type, config.target, 
                  config.interval, config.timeout, config.enabled, dns_servers_json))
        else:
            dns_servers_json = json.dumps(config.dns_servers) if config.dns_servers else None
            cursor.execute('''
                UPDATE test_configs 
                SET name=?, test_type=?, target=?, interval=?, timeout=?, enabled=?, dns_servers=?
                WHERE id=?
            ''', (config.name, config.test_type, config.target, config.interval,
                  config.timeout, config.enabled, dns_servers_json, config.id))
        
        conn.commit()
        conn.close()
        return config
    
    async def delete_config(self, config_id: str):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM test_configs WHERE id=?", (config_id,))
        cursor.execute("DELETE FROM test_results WHERE config_id=?", (config_id,))
        conn.commit()
        conn.close()
    
    async def save_result(self, result: TestResult):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        result.id = str(uuid.uuid4())
        cursor.execute('''
            INSERT INTO test_results (id, config_id, timestamp, success, response_time, error, data)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (result.id, result.config_id, result.timestamp.isoformat(),
              result.success, result.response_time, result.error,
              json.dumps(result.data) if result.data else None))
        
        conn.commit()
        conn.close()
    
    async def get_recent_results(self, limit: int = 1000) -> List[TestResult]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM test_results 
            ORDER BY timestamp DESC 
            LIMIT ?
        ''', (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        
        results = []
        for row in rows:
            results.append(TestResult(
                id=row[0],
                config_id=row[1],
                timestamp=datetime.fromisoformat(row[2]),
                success=bool(row[3]),
                response_time=row[4],
                error=row[5],
                data=json.loads(row[6]) if row[6] else None
            ))
        
        return results
    
    async def get_results_by_timerange(self, hours: int = 24, limit: int = 1000) -> List[TestResult]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM test_results 
            WHERE timestamp >= datetime('now', '-{} hours')
            ORDER BY timestamp DESC 
            LIMIT ?
        '''.format(hours), (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        
        results = []
        for row in rows:
            results.append(TestResult(
                id=row[0],
                config_id=row[1],
                timestamp=datetime.fromisoformat(row[2]),
                success=bool(row[3]),
                response_time=row[4],
                error=row[5],
                data=json.loads(row[6]) if row[6] else None
            ))
        
        return results
        conn.close()
        
        results = []
        for row in rows:
            results.append(TestResult(
                id=row[0],
                config_id=row[1],
                timestamp=datetime.fromisoformat(row[2]),
                success=bool(row[3]),
                response_time=row[4],
                error=row[5],
                data=json.loads(row[6]) if row[6] else None
            ))
        
        return results

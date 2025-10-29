from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import asyncio
import json
from typing import List, Optional
from datetime import datetime, timedelta
from .models import TestConfig, TestResult, TestType
from .network_tests import NetworkTester
from .database import Database

app = FastAPI(title="pingdumb API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = Database()
tester = NetworkTester()
active_connections: List[WebSocket] = []

# Task scheduler state
task_schedule = {}  # {config_id: next_run_time}
running_tasks = set()  # Track currently running tests

@app.on_event("startup")
async def startup():
    await db.init_db()
    asyncio.create_task(scheduler_loop())

@app.get("/api/health")
async def health():
    return {"status": "ok"}

@app.get("/api/configs")
async def get_configs():
    configs = await db.get_configs()
    return [config.dict() for config in configs]

@app.post("/api/configs")
async def create_config(config_data: dict):
    config = TestConfig(
        name=config_data["name"],
        test_type=TestType(config_data["test_type"]),
        target=config_data["target"],
        interval=config_data.get("interval", 30),
        timeout=config_data.get("timeout", 5),
        enabled=config_data.get("enabled", True),
        dns_servers=config_data.get("dns_servers")
    )
    result = await db.save_config(config)
    update_task_schedule(result)  # Add to scheduler
    return result.dict()

@app.put("/api/configs/{config_id}")
async def update_config(config_id: str, config_data: dict):
    config = TestConfig(
        id=config_id,
        name=config_data["name"],
        test_type=TestType(config_data["test_type"]),
        target=config_data["target"],
        interval=config_data.get("interval", 30),
        timeout=config_data.get("timeout", 5),
        enabled=config_data.get("enabled", True),
        dns_servers=config_data.get("dns_servers")
    )
    result = await db.update_config(config)
    update_task_schedule(result)  # Update scheduler
    return result.dict()

@app.delete("/api/configs/{config_id}")
async def delete_config(config_id: str):
    await db.delete_config(config_id)
    remove_from_schedule(config_id)  # Remove from scheduler
    return {"status": "deleted"}

@app.get("/api/results")
async def get_results(
    limit: Optional[int] = None, 
    hours: Optional[int] = None,
    config_id: Optional[str] = None,
    since: Optional[str] = None
):
    results = await db.get_results_by_timerange(hours, limit, config_id, since)
    return [result.dict() for result in results]

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections.remove(websocket)

async def broadcast_result(result: TestResult):
    if active_connections:
        message = json.dumps(result.dict())
        for connection in active_connections[:]:
            try:
                await connection.send_text(message)
            except:
                active_connections.remove(connection)

async def scheduler_loop():
    """Main scheduler loop that respects individual test intervals"""
    while True:
        try:
            now = datetime.utcnow()
            configs = await db.get_configs()
            
            for config in configs:
                if not config.enabled:
                    continue
                    
                # Skip if test is currently running
                if config.id in running_tasks:
                    continue
                
                # Check if it's time to run this test
                next_run = task_schedule.get(config.id, now)
                if now >= next_run:
                    # Schedule the test
                    asyncio.create_task(run_scheduled_test(config))
                    
            await asyncio.sleep(10)  # Check every 10 seconds
        except Exception as e:
            print(f"Scheduler error: {e}")
            await asyncio.sleep(10)

async def run_scheduled_test(config: TestConfig):
    """Run a single test and handle scheduling"""
    try:
        # Mark as running
        running_tasks.add(config.id)
        
        # Run the test
        result = await tester.run_test(config)
        await db.save_result(result)
        await broadcast_result(result)
        
        # Schedule next run
        next_run = datetime.utcnow() + timedelta(seconds=config.interval)
        task_schedule[config.id] = next_run
        
    except Exception as e:
        print(f"Test error for {config.name}: {e}")
        # Still schedule next run even on error
        next_run = datetime.utcnow() + timedelta(seconds=config.interval)
        task_schedule[config.id] = next_run
    finally:
        # Mark as no longer running
        running_tasks.discard(config.id)

def update_task_schedule(config: TestConfig):
    """Update scheduling for a config (called when config is added/updated)"""
    if config.enabled:
        # Schedule to run immediately if new, or keep existing schedule
        if config.id not in task_schedule:
            task_schedule[config.id] = datetime.utcnow()
    else:
        # Remove from schedule if disabled
        task_schedule.pop(config.id, None)
        running_tasks.discard(config.id)

def remove_from_schedule(config_id: str):
    """Remove a config from scheduling (called when config is deleted)"""
    task_schedule.pop(config_id, None)
    running_tasks.discard(config_id)

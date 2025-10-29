from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import asyncio
import json
from typing import List
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

@app.on_event("startup")
async def startup():
    await db.init_db()
    asyncio.create_task(monitoring_loop())

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
    result = await db.save_config(config)
    return result.dict()

@app.delete("/api/configs/{config_id}")
async def delete_config(config_id: str):
    await db.delete_config(config_id)
    return {"status": "deleted"}

@app.get("/api/results")
async def get_results():
    results = await db.get_recent_results()
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

async def monitoring_loop():
    while True:
        try:
            configs = await db.get_configs()
            for config in configs:
                if config.enabled:
                    result = await tester.run_test(config)
                    await db.save_result(result)
                    await broadcast_result(result)
            await asyncio.sleep(30)
        except Exception as e:
            print(f"Monitoring error: {e}")
            await asyncio.sleep(30)

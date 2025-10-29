#!/usr/bin/env python3
import uvicorn
from app.api import app

if __name__ == "__main__":
    uvicorn.run(
        "app.api:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )

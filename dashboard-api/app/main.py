from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import gantt

app = FastAPI(title="Dashboard API", root_path="/dashboard-api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(gantt.router)


@app.get("/health")
def health():
    return {"status": "ok"}

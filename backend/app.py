import hashlib
import json
import time
from datetime import datetime
from typing import Dict, List, Optional
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="EMA Finance Agent Core",
    description="Enterprise Autonomous Finance Engine (EMA-OS)",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Operational State Management
INVOICES_DB: List[Dict] = [
    {
        "invoice_id": "INV-2026-1045",
        "vendor": "Tech Solutions Ltd.",
        "amount": 12850.00,
        "currency": "USD",
        "confidence": 0.942,
        "status": "Pending",
        "flagged_reason": "Variance Threshold (+12.5%)",
        "timestamp": "2026-07-20 10:14:02"
    },
    {
        "invoice_id": "INV-2026-1044",
        "vendor": "CloudSphere Inc.",
        "amount": 8920.00,
        "currency": "USD",
        "confidence": 0.998,
        "status": "Approved",
        "flagged_reason": None,
        "timestamp": "2026-07-20 09:30:11"
    }
]

AUDIT_TRAIL_DB: List[Dict] = []

def compute_sha256(data: dict) -> str:
    serialized = json.dumps(data, sort_keys=True)
    return hashlib.sha256(serialized.encode()).hexdigest()

def record_audit(action: str, actor: str, description: str, invoice_id: str) -> dict:
    entry = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "actor": actor,
        "action": action,
        "invoice_id": invoice_id,
        "description": description
    }
    entry["hash"] = compute_sha256(entry)
    AUDIT_TRAIL_DB.insert(0, entry)
    return entry

# Bootstrapping genesis audit block
record_audit(
    action="SYSTEM_BOOT",
    actor="EMA-OS Core Engine",
    description="Agent engine initialized with policy matrix ruleset v1.0.0",
    invoice_id="SYS-0000"
)

class InvoiceActionPayload(BaseModel):
    invoice_id: str
    action: str  # "APPROVE" or "REJECT"
    actor: Optional[str] = "Pavel [Finance Lead]"
    notes: Optional[str] = None

@app.get("/")
def root():
    return {"agent": "EMA Finance Agent", "status": "active", "version": "1.0.0"}

@app.get("/health")
def health():
    return {"status": "healthy", "latency_ms": 1.2}

@app.get("/invoices")
def list_invoices():
    return {"invoices": INVOICES_DB}

@app.get("/audit/trail")
def list_audit_trail():
    return {"trail": AUDIT_TRAIL_DB}

@app.post("/invoice/upload")
async def process_invoice_upload(
    file: UploadFile = File(...),
    vendor_override: Optional[str] = Form(None),
    amount_override: Optional[float] = Form(None)
):
    time.sleep(1.0)  # Processing simulation for UI telemetry
    filename = file.filename
    inv_id = f"INV-2026-{len(INVOICES_DB) + 1046}"
    
    # Anomaly / Duplicate check logic
    existing_vendors = [i["vendor"].lower() for i in INVOICES_DB]
    vendor = vendor_override or ("Apex Dynamics Inc." if "apex" in filename.lower() else "Nexus Operations Ltd.")
    amount = amount_override or (14950.00 if "apex" in filename.lower() else 5400.00)
    
    confidence = 0.985 if amount < 10000 else 0.942
    is_duplicate = vendor.lower() in existing_vendors and amount in [i["amount"] for i in INVOICES_DB]
    
    requires_human = amount > 10000 or confidence < 0.95 or is_duplicate
    status = "Pending" if requires_human else "Approved"
    
    flag_reason = None
    if is_duplicate:
        flag_reason = "Duplicate Invoice Anomaly Detected"
    elif amount > 10000:
        flag_reason = "Exceeds $10,000 Spend Threshold"
    elif confidence < 0.95:
        flag_reason = "Low OCR Extraction Confidence"

    new_invoice = {
        "invoice_id": inv_id,
        "vendor": vendor,
        "amount": amount,
        "currency": "USD",
        "confidence": confidence,
        "status": status,
        "flagged_reason": flag_reason,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    
    INVOICES_DB.insert(0, new_invoice)
    
    record_audit(
        action="INVOICE_EXTRACTED",
        actor="EMA ExtractionAgent",
        description=f"Processed '{filename}'. Vendor: {vendor}, Amount: ${amount:,.2f}, Confidence: {confidence*100:.1f}%",
        invoice_id=inv_id
    )
    
    if requires_human:
        record_audit(
            action="HITL_ESCALATED",
            actor="EMA PolicyEngine",
            description=f"Escalated invoice {inv_id} for review. Policy Flag: {flag_reason}",
            invoice_id=inv_id
        )
    else:
        record_audit(
            action="AUTO_APPROVED",
            actor="EMA PolicyEngine",
            description=f"Invoice {inv_id} passed automated compliance rules.",
            invoice_id=inv_id
        )

    return {"status": "success", "invoice": new_invoice}

@app.post("/invoice/action")
def execute_invoice_action(payload: InvoiceActionPayload):
    invoice = next((i for i in INVOICES_DB if i["invoice_id"] == payload.invoice_id), None)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    new_status = "Approved" if payload.action.upper() == "APPROVE" else "Rejected"
    invoice["status"] = new_status
    
    audit_record = record_audit(
        action=f"HITL_{payload.action.upper()}",
        actor=payload.actor,
        description=f"Invoice status updated to '{new_status}'. Reason: {payload.notes or 'Manual manager override.'}",
        invoice_id=payload.invoice_id
    )
    
    return {"status": "success", "invoice": invoice, "audit": audit_record}
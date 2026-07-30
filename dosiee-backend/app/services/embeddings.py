from sentence_transformers import SentenceTransformer
from sqlalchemy.orm import Session
from sqlalchemy import text
from app import models

_model = None

def _get_embedding_model():
    global _model
    if _model is None:
        # Free, local, runs on CPU — no API key, no cost, swappable later
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def embed_text(content: str):
    model = _get_embedding_model()
    return model.encode(content).tolist()


def chunk_drug_record(drug: models.Drug):
    """Splits one Drug row into labeled chunks — finer-grained retrieval
    than embedding the whole record as one blob."""
    chunks = []
    if drug.indications:
        chunks.append(("indications", f"{drug.generic_name} is used for: {drug.indications}"))
    if drug.dosage_info:
        chunks.append(("dosage", f"{drug.generic_name} dosage information: {drug.dosage_info}"))
    if drug.warnings:
        chunks.append(("warnings", f"{drug.generic_name} warnings: {drug.warnings}"))
    if drug.side_effects:
        chunks.append(("side_effects", f"{drug.generic_name} side effects: {drug.side_effects}"))
    return chunks


def index_drug(db: Session, drug: models.Drug):
    """Embeds and stores all chunks for a drug — call this once after
    get_drug_info() successfully caches a new drug."""
    existing = db.query(models.DrugEmbedding).filter(models.DrugEmbedding.drug_name == drug.generic_name).first()
    if existing:
        return  # already indexed

    for label, content in chunk_drug_record(drug):
        vector = embed_text(content)
        db.add(models.DrugEmbedding(drug_name=drug.generic_name, content=content, embedding=vector))
    db.commit()


def retrieve_relevant_chunks(db: Session, query: str, k: int = 4):
    """The actual RAG retrieval step — finds the k closest chunks to
    the user's question using cosine distance in pgvector."""
    query_vector = embed_text(query)
    results = db.execute(
        text("""
            SELECT content, drug_name, embedding <-> CAST(:qv AS vector) AS distance
            FROM drug_embeddings
            ORDER BY distance ASC
            LIMIT :k
        """),
        {"qv": str(query_vector), "k": k}
    ).fetchall()
    return [{"content": r.content, "drug_name": r.drug_name} for r in results]
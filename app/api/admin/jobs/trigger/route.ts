/**
 * POST /api/admin/jobs/trigger
 * Trigger a PubMed ingestion job — fetches papers via NCBI API
 * and stores them directly in PostgreSQL.
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds

interface PubMedArticle {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  journal: string;
  pubDate: string;
  pmid: string;
  doi: string | null;
}

async function fetchPubMed(searchQuery: string, limit: number): Promise<PubMedArticle[]> {
  const email = process.env.NCBI_EMAIL ?? "medica@research.local";
  const apiKey = process.env.NCBI_API_KEY ? `&api_key=${process.env.NCBI_API_KEY}` : "";
  const base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

  // Search for IDs
  const searchUrl = `${base}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchQuery)}&retmax=${limit}&retmode=json&email=${email}${apiKey}`;
  const searchRes = await fetch(searchUrl);
  const searchJson = await searchRes.json() as { esearchresult: { idlist: string[] } };
  const ids: string[] = searchJson.esearchresult?.idlist ?? [];
  if (ids.length === 0) return [];

  // Fetch summaries
  const fetchUrl = `${base}/efetch.fcgi?db=pubmed&id=${ids.join(",")}&retmode=xml&email=${email}${apiKey}`;
  const fetchRes = await fetch(fetchUrl);
  const xml = await fetchRes.text();

  // Lightweight XML parsing with regex (avoids heavy XML libraries)
  const articles: PubMedArticle[] = [];
  const articleMatches = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) ?? [];

  for (const articleXml of articleMatches) {
    const getText = (tag: string) => {
      const m = articleXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "i"));
      return m ? m[1].replace(/<[^>]+>/g, "").trim() : "";
    };
    const pmid = getText("PMID");
    const title = getText("ArticleTitle");
    const abstract = getText("AbstractText");
    const journal = getText("Title") || getText("ISOAbbreviation");
    const pubYear = getText("Year") || getText("MedlineDate")?.slice(0, 4) || "";
    const pubMonth = getText("Month") || "01";
    const pubDate = pubYear ? `${pubYear}-${pubMonth.padStart(2, "0")}-01` : "";

    // Authors
    const authorMatches = articleXml.match(/<Author[^>]*>[\s\S]*?<\/Author>/g) ?? [];
    const authors = authorMatches.map((a) => {
      const last = a.match(/<LastName>([^<]*)<\/LastName>/)?.[1] ?? "";
      const fore = a.match(/<ForeName>([^<]*)<\/ForeName>/)?.[1] ?? "";
      return `${last}${fore ? " " + fore : ""}`.trim();
    }).filter(Boolean);

    // DOI
    const doiMatch = articleXml.match(/<ArticleId IdType="doi">([^<]*)<\/ArticleId>/i);
    const doi = doiMatch ? doiMatch[1].trim() : null;

    if (pmid && title) {
      articles.push({ id: uuidv4(), pmid, title, abstract, authors, journal, pubDate, doi });
    }
  }

  return articles;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const searchQueryParam: string = body.query ?? "";
  const limit: number = Math.min(body.limit ?? 10, 50);
  const source: string = body.source ?? "pubmed";

  if (!searchQueryParam) {
    return NextResponse.json({ detail: "query is required" }, { status: 400 });
  }

  const jobId = uuidv4();

  // Create job record
  try {
    await query(
      `INSERT INTO ingestion_jobs (id, job_name, source, query, status, created_at, started_at)
       VALUES ($1, $2, $3, $4, 'running', NOW(), NOW())`,
      [jobId, `manual_${searchQueryParam.slice(0, 50).replace(/ /g, "_")}`, source, searchQueryParam]
    );
  } catch (err) {
    console.error("job_create_error", err);
    return NextResponse.json({ detail: "Failed to create job record" }, { status: 500 });
  }

  let fetched = 0;
  let indexed = 0;
  let failed = 0;

  try {
    const articles = await fetchPubMed(searchQueryParam, limit);
    fetched = articles.length;

    for (const article of articles) {
      try {
        await query(
          `INSERT INTO paper_records
             (id, title, abstract, pmid, doi, journal, published, authors, source,
              verification_status, confidence_score, evidence_level, study_type,
              tags, keywords, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8,$9,'unverified',0.5,'unknown','other',$10,$11,NOW(),NOW())
           ON CONFLICT (pmid) DO NOTHING`,
          [
            article.id, article.title, article.abstract,
            article.pmid, article.doi, article.journal,
            article.pubDate || null,
            JSON.stringify(article.authors),
            "pubmed",
            JSON.stringify({ cancer: [], drugs: [], biomarkers: [], treatment: [] }),
            JSON.stringify([]),
          ]
        );
        indexed++;
      } catch {
        failed++;
      }
    }

    await query(
      `UPDATE ingestion_jobs SET status='done', fetched=$1, processed=$2, failed=$3, completed_at=NOW() WHERE id=$4`,
      [fetched, indexed, failed, jobId]
    );
  } catch (err) {
    console.error("ingestion_error", err);
    await query(
      `UPDATE ingestion_jobs SET status='failed', error_message=$1, completed_at=NOW() WHERE id=$2`,
      [String(err), jobId]
    );
  }

  return NextResponse.json({
    status: "done",
    job_id: jobId,
    message: `Ingestion complete: ${indexed} papers indexed from '${searchQueryParam}'.`,
  });
}

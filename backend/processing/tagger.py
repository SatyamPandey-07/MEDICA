"""
MEDICA Auto-Tagger
Extracts and assigns canonical oncology tags to papers.
Covers: cancers, drugs, biomarkers, genes, treatments, evidence quality, study type, temporal.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from core.logging import get_logger
from core.types import EvidenceLevel, PaperMetadata, PaperTags, TrialPhase
from shared.utils import resolve_alias

logger = get_logger(__name__)


@dataclass
class TagPattern:
    """A tag pattern with its canonical name and regex patterns."""
    canonical: str
    patterns: list[str]
    compiled: list[re.Pattern] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.compiled = [re.compile(p, re.IGNORECASE) for p in self.patterns]

    def matches(self, text: str) -> bool:
        return any(p.search(text) for p in self.compiled)


# ============================================================
# Cancer Type Patterns
# ============================================================
CANCER_PATTERNS: list[TagPattern] = [
    TagPattern("breast_cancer", [r"\bbreast\s+cancer\b", r"\bbreast\s+carcinoma\b", r"\bbreast\s+tumor\b"]),
    TagPattern("triple_negative_breast_cancer", [r"\btriple.?negative\b", r"\bTNBC\b"]),
    TagPattern("her2_positive_breast_cancer", [r"\bHER2.?positive\b", r"\bHER2\+\b"]),
    TagPattern("non_small_cell_lung_cancer", [r"\bNSCLC\b", r"\bnon.?small.?cell\s+lung\b"]),
    TagPattern("small_cell_lung_cancer", [r"\bSCLC\b", r"\bsmall.?cell\s+lung\b"]),
    TagPattern("lung_cancer", [r"\blung\s+cancer\b", r"\blung\s+carcinoma\b", r"\bpulmonary\s+adenocarcinoma\b"]),
    TagPattern("glioblastoma", [r"\bglioblastoma\b", r"\bGBM\b", r"\bgrade\s+IV\s+glioma\b"]),
    TagPattern("colorectal_cancer", [r"\bcolorectal\b", r"\bcolon\s+cancer\b", r"\brectal\s+cancer\b", r"\bCRC\b"]),
    TagPattern("prostate_cancer", [r"\bprostate\s+cancer\b", r"\bprostate\s+carcinoma\b"]),
    TagPattern("pancreatic_cancer", [r"\bpancreatic\s+cancer\b", r"\bpancreatic\s+ductal\b", r"\bPDAC\b", r"\bPDA\b"]),
    TagPattern("melanoma", [r"\bmelanoma\b", r"\bcutaneous\s+melanoma\b"]),
    TagPattern("leukemia", [r"\bleukemia\b", r"\bleukaemia\b", r"\bAML\b", r"\bCLL\b", r"\bALL\b"]),
    TagPattern("lymphoma", [r"\blymphoma\b", r"\bDLBCL\b", r"\bHodgkin\b", r"\bNHL\b"]),
    TagPattern("ovarian_cancer", [r"\bovarian\s+cancer\b", r"\bovarian\s+carcinoma\b"]),
    TagPattern("renal_cell_carcinoma", [r"\brenal\s+cell\s+carcinoma\b", r"\bRCC\b", r"\bkidney\s+cancer\b"]),
    TagPattern("hepatocellular_carcinoma", [r"\bhepatocellular\s+carcinoma\b", r"\bHCC\b", r"\bliver\s+cancer\b"]),
    TagPattern("multiple_myeloma", [r"\bmultiple\s+myeloma\b", r"\bplasma\s+cell\s+myeloma\b"]),
    TagPattern("bladder_cancer", [r"\bbladder\s+cancer\b", r"\burothelial\s+carcinoma\b"]),
    TagPattern("gastric_cancer", [r"\bgastric\s+cancer\b", r"\bstomach\s+cancer\b"]),
    TagPattern("cervical_cancer", [r"\bcervical\s+cancer\b", r"\bcervical\s+carcinoma\b"]),
    TagPattern("thyroid_cancer", [r"\bthyroid\s+cancer\b", r"\bthyroid\s+carcinoma\b"]),
]

# ============================================================
# Drug Patterns
# ============================================================
DRUG_PATTERNS: list[TagPattern] = [
    TagPattern("pembrolizumab", [r"\bpembrolizumab\b", r"\bKeytruda\b"]),
    TagPattern("nivolumab", [r"\bnivolumab\b", r"\bOpdivo\b"]),
    TagPattern("atezolizumab", [r"\batezolizumab\b", r"\bTecentriq\b"]),
    TagPattern("durvalumab", [r"\bdurvalumab\b", r"\bImfinzi\b"]),
    TagPattern("ipilimumab", [r"\bipilimumab\b", r"\bYervoy\b"]),
    TagPattern("trastuzumab", [r"\btrastuzumab\b", r"\bHerceptin\b"]),
    TagPattern("bevacizumab", [r"\bbevacizumab\b", r"\bAvastin\b"]),
    TagPattern("osimertinib", [r"\bosimertinib\b", r"\bTagrisso\b"]),
    TagPattern("olaparib", [r"\bolaparib\b", r"\bLynparza\b"]),
    TagPattern("palbociclib", [r"\bpalbociclib\b", r"\bIbrance\b"]),
    TagPattern("ribociclib", [r"\bribociclib\b", r"\bKisqali\b"]),
    TagPattern("abemaciclib", [r"\babemaciclib\b", r"\bVerzenio\b"]),
    TagPattern("docetaxel", [r"\bdocetaxel\b", r"\bTaxotere\b"]),
    TagPattern("paclitaxel", [r"\bpaclitaxel\b", r"\bTaxol\b"]),
    TagPattern("cisplatin", [r"\bcisplatin\b", r"\bplatinum.?based\b"]),
    TagPattern("carboplatin", [r"\bcarboplatin\b"]),
    TagPattern("capecitabine", [r"\bcapecitabine\b", r"\bXeloda\b"]),
    TagPattern("imatinib", [r"\bimatinib\b", r"\bGleevec\b", r"\bGlivec\b"]),
    TagPattern("sunitinib", [r"\bsunitinib\b", r"\bSutent\b"]),
    TagPattern("sorafenib", [r"\bsorafenib\b", r"\bNexavar\b"]),
    TagPattern("vemurafenib", [r"\bvemurafenib\b", r"\bZelboraf\b"]),
    TagPattern("dabrafenib", [r"\bdabrafenib\b", r"\bTafinlar\b"]),
    TagPattern("trametinib", [r"\btrametinib\b", r"\bMekinist\b"]),
    TagPattern("enzalutamide", [r"\benzalutamide\b", r"\bXtandi\b"]),
    TagPattern("abiraterone", [r"\babiraterone\b", r"\bZytiga\b"]),
    TagPattern("talazoparib", [r"\btalazoparib\b", r"\bTalzenna\b"]),
]

# ============================================================
# Biomarker Patterns
# ============================================================
BIOMARKER_PATTERNS: list[TagPattern] = [
    TagPattern("pd-l1", [r"\bPD-?L1\b", r"\bCD274\b"]),
    TagPattern("pd-1", [r"\bPD-?1\b", r"\bPDCD1\b"]),
    TagPattern("her2", [r"\bHER2\b", r"\bHER-2\b", r"\bERBB2\b"]),
    TagPattern("egfr", [r"\bEGFR\b", r"\bepidermal\s+growth\s+factor\s+receptor\b"]),
    TagPattern("kras", [r"\bKRAS\b"]),
    TagPattern("braf", [r"\bBRAF\b"]),
    TagPattern("brca1", [r"\bBRCA1\b", r"\bBRCA-1\b"]),
    TagPattern("brca2", [r"\bBRCA2\b", r"\bBRCA-2\b"]),
    TagPattern("tp53", [r"\bTP53\b", r"\bp53\b"]),
    TagPattern("alk", [r"\bALK\b", r"\banaplastic\s+lymphoma\s+kinase\b"]),
    TagPattern("ros1", [r"\bROS1\b"]),
    TagPattern("met", [r"\bMET\s+amplification\b", r"\bMET\s+exon\b", r"\bcMET\b"]),
    TagPattern("msi_high", [r"\bMSI.?H\b", r"\bmicrosatellite\s+instability.{0,10}high\b"]),
    TagPattern("tmb_high", [r"\bTMB.?H\b", r"\btumor\s+mutational\s+burden.{0,10}high\b"]),
    TagPattern("mismatch_repair_deficient", [r"\bdMMR\b", r"\bdeficient\s+mismatch\s+repair\b"]),
    TagPattern("pten", [r"\bPTEN\b"]),
    TagPattern("pik3ca", [r"\bPIK3CA\b"]),
    TagPattern("nras", [r"\bNRAS\b"]),
    TagPattern("ret", [r"\bRET\s+fusion\b", r"\bRET\s+rearrangement\b"]),
    TagPattern("ntrk", [r"\bNTRK\b", r"\btropomyosin\s+receptor\s+kinase\b"]),
    TagPattern("ctla4", [r"\bCTLA.?4\b", r"\bipilimumab\s+target\b"]),
]

# ============================================================
# Treatment Patterns
# ============================================================
TREATMENT_PATTERNS: list[TagPattern] = [
    TagPattern("immunotherapy", [r"\bimmunotherapy\b", r"\bimmune\s+checkpoint\b", r"\bcheckpoint\s+inhibitor\b"]),
    TagPattern("chemotherapy", [r"\bchemotherapy\b", r"\bcytotoxic\b"]),
    TagPattern("targeted_therapy", [r"\btargeted\s+therapy\b", r"\btargeted\s+treatment\b"]),
    TagPattern("radiation_therapy", [r"\bradiation\s+therapy\b", r"\bradiotherapy\b", r"\bstereotactic\b"]),
    TagPattern("surgery", [r"\bsurgical\s+resection\b", r"\bnephrectomy\b", r"\blobectomy\b", r"\bmastectomy\b"]),
    TagPattern("car_t_cell", [r"\bCAR-?T\b", r"\bchimeric\s+antigen\s+receptor\b"]),
    TagPattern("bone_marrow_transplant", [r"\bbone\s+marrow\s+transplant\b", r"\bstem\s+cell\s+transplant\b", r"\bHSCT\b"]),
    TagPattern("hormone_therapy", [r"\bhormone\s+therapy\b", r"\bendocrine\s+therapy\b", r"\bandrogen\s+deprivation\b"]),
    TagPattern("combination_therapy", [r"\bcombination\s+therapy\b", r"\bdual\s+therapy\b", r"\bcombined\s+treatment\b"]),
    TagPattern("maintenance_therapy", [r"\bmaintenance\s+therapy\b", r"\bmaintenance\s+treatment\b"]),
    TagPattern("adjuvant_therapy", [r"\badjuvant\b"]),
    TagPattern("neoadjuvant_therapy", [r"\bneoadjuvant\b"]),
]

# ============================================================
# Evidence Quality Patterns
# ============================================================
EVIDENCE_PATTERNS: list[TagPattern] = [
    TagPattern("high_confidence", [r"\bstatistically\s+significant\b", r"\bp\s*<\s*0\.05\b", r"\bP\s*<\s*0\.001\b"]),
    TagPattern("phase_3", [r"\bphase\s*3\b", r"\bphase\s*III\b"]),
    TagPattern("phase_2", [r"\bphase\s*2\b", r"\bphase\s*II\b"]),
    TagPattern("phase_1", [r"\bphase\s*1\b", r"\bphase\s*I\b"]),
    TagPattern("fda_approved", [r"\bFDA.?approved\b", r"\bFDA\s+approval\b"]),
    TagPattern("guideline_backed", [r"\bclinical\s+guideline\b", r"\bNCCN\b", r"\bESMO\b", r"\bASCO\b"]),
    TagPattern("replicated", [r"\breplication\b", r"\breplicated\b", r"\bconfirmed\s+in\b"]),
    TagPattern("disputed", [r"\bcontroversial\b", r"\bdisputed\b", r"\bconflicting\s+evidence\b"]),
    TagPattern("preclinical_only", [r"\bpreclinical\b", r"\bcell\s+line\b", r"\bin\s+vitro\b"]),
    TagPattern("small_sample", [r"\bsmall\s+sample\b", r"\bn\s*=\s*\d{1,2}\b"]),
]


class Tagger:
    """
    Auto-tagging engine for oncology papers.

    Scans title + abstract for entity patterns and assigns
    canonical tags across all tag dimensions.
    """

    def _scan(self, text: str, patterns: list[TagPattern]) -> list[str]:
        """Return canonical tags from all matching patterns."""
        return [p.canonical for p in patterns if p.matches(text)]

    def _detect_trial_phase(self, text: str) -> TrialPhase | None:
        if re.search(r"phase\s*(III|3)\b", text, re.IGNORECASE):
            return TrialPhase.PHASE_3
        if re.search(r"phase\s*(II|2)\b", text, re.IGNORECASE):
            return TrialPhase.PHASE_2
        if re.search(r"phase\s*(I|1)\b", text, re.IGNORECASE):
            return TrialPhase.PHASE_1
        if re.search(r"phase\s*(IV|4)\b", text, re.IGNORECASE):
            return TrialPhase.PHASE_4
        return None

    def _temporal_tags(self, paper: PaperMetadata) -> list[str]:
        tags = []
        if paper.published:
            year = paper.published.year
            if year >= 2020:
                tags.append("recent")
            elif year >= 2015:
                tags.append("recent_5yr")
            elif year >= 2010:
                tags.append("decade_old")
            else:
                tags.append("older_literature")
            tags.append(str(year))
        return tags

    async def tag(self, paper: PaperMetadata) -> PaperMetadata:
        """Assign tags to a paper based on its title and abstract."""
        text = f"{paper.title} {paper.abstract or ''}"

        paper.tags = PaperTags(
            cancer=self._scan(text, CANCER_PATTERNS),
            drugs=self._scan(text, DRUG_PATTERNS),
            biomarkers=self._scan(text, BIOMARKER_PATTERNS),
            treatment=self._scan(text, TREATMENT_PATTERNS),
            evidence=self._scan(text, EVIDENCE_PATTERNS),
            study_type=[paper.study_type.value],
            temporal=self._temporal_tags(paper),
            outcomes=[],
            system=["ingested"],
        )

        # Detect trial phase
        trial_phase = self._detect_trial_phase(text)
        if trial_phase:
            paper.trial_phase = trial_phase

        logger.debug(
            "paper_tagged",
            pmid=paper.pmid,
            cancers=paper.tags.cancer,
            drugs=paper.tags.drugs,
            biomarkers=paper.tags.biomarkers,
        )

        return paper

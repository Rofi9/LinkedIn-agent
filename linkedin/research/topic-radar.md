# Topic radar: what Darman.ai can post about

Written 2026-09-28 for someone without a medical background. Start here.

**Files in this folder**
- `topic-radar.md` (this file): the topics, in plain English, with post ideas.
- `hospitals.md`: 16 hospitals implementing AI, with sources.
- `physician-voices.md`: 18 doctors who post about AI (who to follow and
  comment on), plus the debates they're having.
- `government.md`: what governments and regulators are doing, binding vs
  guidance.
- `competitors.md`: 11 companies like Darman and what they post; the gaps.

**How to use it each week**
1. Pick a topic below. Each one says what it is, why doctors care, and a
   Darman angle.
2. Open the source and paste it into `/li-explain` if anything's unclear.
3. Draft with `/li-post`. It reads `voice.md` and won't invent numbers.
4. Spend 20 minutes commenting on posts by people in `physician-voices.md`
   (`/li-comment`).

**Rules that apply to every item**
- Items marked (verify) are preprints, vendor claims or secondary reports.
  Open the primary source before posting a number.
- Never present a vendor's own numbers as independent evidence.
- Don't claim AI improves patient outcomes; almost nothing here measures that.

---

## The five content pillars

Every topic maps to one of Darman's positions in `voice.md`:

| Pillar | Darman's position | Topics that feed it |
|---|---|---|
| **A. Generic isn't enough** | Specialty-specific beats generic AI training | 4, 5, 6, 7, 12 |
| **B. Access isn't the barrier, knowing how is** | Clinicians have the tools; they lack the judgment on when to use them | 1, 3, 13, 16 |
| **C. Limitations matter as much as use cases** | Teach failure modes, not just wins | 8, 9, 10, 11, 15, 18 |
| **D. Doctors learn best from doctors** | Show a real physician's workflow | 1, 3, 12 |
| **E. Not a one-time training day** | AI literacy is ongoing | 12, 14, 17, government items |

---

## The topics

### 1. Ambient AI scribes
- **In plain English:** An app listens to the doctor–patient conversation
  (with consent) and drafts the visit note. The doctor reviews and signs it.
- **Why doctors care:** Paperwork eats hours of every day.
- **Evidence:** A randomized trial of 238 physicians: one scribe cut note time
  by 9.5%, the other made no significant difference; occasional clinically
  significant errors (`evidence.md` B3).
  https://ai.nejm.org/doi/abs/10.1056/AIoa2501000 · Real rollouts: Cleveland
  Clinic, Kaiser, GOSH, PureHealth, Quirónsalud (`hospitals.md`).
- **Darman angle:** "The scribe drafts. You sign. Here's what to check before
  you sign."
- **Don't overclaim:** time savings are modest. Never promise "hours back".

### 2. AI and burnout
- **In plain English:** Burnout is exhaustion from work. Tools that cut
  paperwork may reduce it.
- **Evidence:** In 263 clinicians across 6 US health systems, burnout fell from
  51.9% to 38.8% after 30 days with a scribe. No randomized control group.
  https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2839542
- **Darman angle:** "What AI can fix about burnout, and what it can't."
- **Don't overclaim:** short-term and self-reported. Not a cure.

### 3. AI answer tools for doctors (OpenEvidence, UpToDate Expert AI)
- **In plain English:** Chat tools that answer doctors' clinical questions
  from medical literature, with citations.
- **Evidence:** Widely used by US physicians (NBC):
  https://www.nbcnews.com/tech/tech-news/openevidence-ai-doctor-medical-physician-login-app-what-npi-uptodate-rcna341064 ·
  a preprint found 34–41% accuracy on complex subspecialty cases (verify, not
  peer reviewed): https://www.medrxiv.org/content/10.64898/2025.11.29.25341091v1.full
- **Darman angle:** "Read the citation, not just the answer."
- **Don't overclaim:** don't attack a named product; frame it as a skill.

### 4. Radiology and imaging
- **In plain English:** AI reads or sorts scans (mammograms, CT, X-rays) by
  urgency. Radiology holds about 76% of FDA-authorized AI devices.
  https://theimagingwire.com/2025/12/10/ai-enabled-medical-devices-granted-fda-marketing-authorization/
- **Evidence:** The MASAI trial, 105,934 women in Sweden: AI-supported
  screening found 6.4 cancers per 1,000 vs 5.0, and radiologists' reading
  workload fell 44% (`evidence.md` B1, B2).
- **Darman angle:** "The first randomized evidence for AI screening. What it
  does and doesn't show."
- **Don't overclaim:** **do not** say "12% fewer interval cancers". That
  figure comes from press coverage; the trial's interval-cancer result was
  non-inferior and not significant (`evidence.md` §F). One product, one
  country.

### 5. Pathology
- **In plain English:** Pathologists diagnose disease from tissue on glass
  slides. Digital pathology scans them so AI can analyze the images.
- **Evidence:** 51 FDA-authorized pathology AI devices as of April 2026, only 7
  analyzing whole slides. https://pmc.ncbi.nlm.nih.gov/articles/PMC13183467/
- **Darman angle:** "Why pathology AI lags radiology: most labs still use
  glass."
- **Don't overclaim:** AI isn't diagnosing cancer on its own.

### 6. Dermatology
- **In plain English:** AI assesses skin spots for cancer from photos or
  handheld devices.
- **Evidence:** DermaSensor, an FDA-cleared device, was asked for more testing
  in darker skin because trial patients were mostly White.
  https://pmc.ncbi.nlm.nih.gov/articles/PMC11180084/ · Only 10.2% of
  AI-generated skin images showed dark skin.
  https://onlinelibrary.wiley.com/doi/10.1111/jdv.20849
- **Darman angle:** "Ask what skin tones the tool was tested on."

### 7. Cardiology
- **In plain English:** AI reads a routine heart tracing (ECG) to flag hidden
  heart disease.
- **Evidence:** EchoNext (Nature, 2025) detected 77% of structural heart
  disease vs 64% for cardiologists without AI; later FDA-cleared.
  https://www.nature.com/articles/s41586-025-09227-0
- **Darman angle:** "The ECG you already order may hold more information."
- **Don't overclaim:** it's a flag that leads to a heart ultrasound, not a
  diagnosis.

### 8. Hallucinations
- **In plain English:** AI confidently stating something false.
- **Evidence:** Mount Sinai planted one fake lab value or disease in clinical
  cases; six LLMs repeated or expanded on it 50–82% of the time.
  https://www.nature.com/articles/s43856-025-01021-3 · Ontario: 9 of 20 AI
  scribes invented clinical details (`hospitals.md`).
- **Darman angle:** "AI believes your typos."
- **Don't overclaim:** test conditions; newer models may differ.

### 9. Automation bias
- **In plain English:** trusting a machine's suggestion over your own
  judgment.
- **Evidence:** 44 physicians who'd had AI training: accuracy 73.3% with flawed
  ChatGPT suggestions vs 84.9% with correct ones.
  https://ai.nejm.org/doi/full/10.1056/AIoa2501001
- **Darman angle:** "Training alone didn't protect them. Habits might."
- **Don't overclaim:** written cases, not real patients. And note the study is
  awkward for a training company; say so honestly.

### 10. Deskilling
- **In plain English:** losing a skill by leaning on AI.
- **Evidence:** In colonoscopies without AI, detection of precancerous growths
  fell from 28.4% to 22.4% after doctors had been using AI (`evidence.md` E2).
- **Darman angle:** "Use it, but don't lose it."
- **Don't overclaim:** observational, 19 doctors; can't prove cause.

### 11. Privacy and "shadow AI"
- **In plain English:** staff using unapproved AI tools, sometimes with patient
  data.
- **Evidence:** A Wolters Kluwer survey: 17% of shadow-AI users sometimes or
  often include identifiable patient data (verify primary report).
  https://www.healthcaredive.com/news/shadow-unauthorized-ai-/810191/ · Sharp
  HealthCare consent lawsuit, allegations only (`hospitals.md`).
- **Darman angle:** "What never goes into a public chatbot."
- **Don't overclaim:** no legal advice; point to institutional policy.

### 12. AI in medical education
- **In plain English:** medical schools and residency (specialty training
  after medical school) are adding AI.
- **Evidence:** US medical schools with AI in the curriculum rose from 53% to
  77% (2023–2024); AAMC principles for responsible use.
  https://www.aamc.org/about-us/mission-areas/medical-education/principles-ai-use ·
  India's free national AI course for ~50,000 doctors (`hospitals.md`).
- **Darman angle:** "How do you learn clinical reasoning when AI can do the
  homework?"

### 13. Patients using ChatGPT for health
- **In plain English:** patients ask chatbots about symptoms and results.
- **Evidence:** OpenAI says 40 million people a day ask ChatGPT health
  questions (OpenAI's own figure); ChatGPT Health launched Jan 2026.
  https://openai.com/index/introducing-chatgpt-health/ · An Oxford randomized
  study of ~1,300 people: chatbot users made no better decisions than people
  using web search.
  https://www.ox.ac.uk/news/2026-02-10-new-study-warns-risks-ai-chatbots-giving-medical-advice
- **Darman angle:** "Your patient already asked ChatGPT. Now what?"

### 14. Liability
- **In plain English:** who's at fault when AI is involved in an error.
- **Evidence:** Mock-jury study: when AI flagged a scan and the radiologist
  still missed a brain bleed, 75% of jurors blamed the radiologist.
  https://www.nature.com/articles/s44360-026-00085-2
- **Darman angle:** "If AI flags it and you miss it, a jury may notice."
- **Don't overclaim:** hypothetical jurors, not case law.

### 15. Bias and equity
- **In plain English:** AI treating patient groups differently.
- **Evidence:** 9 LLMs, 1.7M outputs: identical cases labeled Black, unhoused or
  LGBTQIA+ were more often sent for urgent care, invasive procedures or
  mental-health evaluation. https://www.nature.com/articles/s41591-025-03626-6
- **Darman angle:** "Same patient, different label, different advice."

### 16. Agentic AI in hospitals
- **In plain English:** AI that takes actions (fills forms, drafts discharge
  summaries), not just answers questions.
- **Evidence:** Epic showed its Art, Emmie and Penny agents at HIMSS 2026
  (vendor claims, verify).
  https://www.fiercehealthcare.com/ai-and-machine-learning/himss26-epic-expands-ai-roadmap-previews-factory-build-and-orchestrate-ai
- **Darman angle:** "When AI acts, who checks its work?"

### 17. Regulation
- **In plain English:** the rules on which AI tools need approval, and on
  training staff. See `government.md`.
- **Darman angle:** "Not FDA-reviewed doesn't mean validated." / "Only 4 of 50
  European-region countries have a health AI strategy."
- **Don't overclaim:** say binding vs guidance; foreign rules don't bind
  Armenian or Gulf hospitals.

### 18. Benchmark hype and AI-drafted patient messages
- **In plain English:** vendors claim "superhuman" diagnosis on puzzle cases;
  meanwhile AI drafts of patient replies sometimes take longer to edit.
- **Evidence:** Microsoft reports MAI-DxO solved 85.5% of hard NEJM cases
  (company-reported, not peer reviewed, verify).
  https://microsoft.ai/news/the-path-to-medical-superintelligence/ · Memorial
  Hermann: 9 seconds saved per note, 32% fewer follow-up questions
  (`hospitals.md`).
- **Darman angle:** "Puzzle cases aren't your Tuesday clinic."

---

## 12 post ideas ready to draft

Each rests on a sourced fact. Run through `/li-post`.

| # | Hook idea | Pillar | Rests on |
|---|---|---|---|
| 1 | "4,000 clinicians in 4 months. Cleveland Clinic called it a gift, not a mandate." | B | hospitals.md #1 |
| 2 | "Nine seconds. That's how much time the AI saved per note. It still worked." | C | hospitals.md #4 |
| 3 | "9 of 20 AI scribes invented something that never happened." | C | hospitals.md #7 |
| 4 | "AI believes your typos." | C | Topic 8 |
| 5 | "Same patient. Different label. Different advice." | C | Topic 15 |
| 6 | "Your patient already asked ChatGPT. Now what?" | B | Topic 13 |
| 7 | "Doctors trained in AI still followed its wrong suggestions." | C | Topic 9 |
| 8 | "Only 4 of 50 countries in WHO's European region have a health AI strategy." | E | government.md (WHO) |
| 9 | "The EU softened its AI literacy rule. It didn't delete it." | E | government.md (EU) |
| 10 | "India is training 50,000 doctors in AI for free. What's the plan here?" | E | hospitals.md #16 |
| 11 | "Ask what skin tones the tool was tested on." | A | Topic 6 |
| 12 | "If the AI flags it and you miss it, who does the jury blame?" | C | Topic 14 |

## Where Darman can own the conversation

From `competitors.md` and `physician-voices.md`:
- **Armenia, the Caucasus and the CIS have almost no public voice on clinical
  AI.** No Armenian hospital has announced generative AI; no
  Russian-speaking physician AI voice was found. Darman's physician
  instructors can become that voice.
- **Hands-on and specialty-specific** is where competitors are thin.
- **Gulf governments are training at scale** (Abu Dhabi academy, Dubai's "One
  Million AI Prompters"). These are partnership targets as much as
  competitors.

---

## Glossary

- **LLM (large language model):** the AI behind chatbots; it predicts text.
- **Generative AI:** AI that creates text or images.
- **Ambient scribe:** AI that listens to a visit and drafts the note.
- **EHR:** electronic health record, the patient's digital chart.
- **Hallucination:** confident but false AI output.
- **Automation bias:** over-trusting a machine's suggestion.
- **Deskilling:** skills fading from reliance on AI.
- **Randomized controlled trial (RCT):** chance decides who gets the tool. The
  strongest evidence.
- **Observational study:** researchers watch without assigning groups. Can't
  prove cause.
- **Preprint:** a study not yet peer reviewed.
- **Non-inferior:** shown not to be worse than the standard, not shown to be
  better.
- **Sensitivity:** the share of real cases a test catches.
- **Triage:** sorting cases by urgency.
- **Adenoma:** a precancerous growth, e.g. in the colon.
- **ECG / echocardiogram:** heart-rhythm tracing / heart ultrasound.
- **Interval cancer:** cancer found between scheduled screenings.
- **HIPAA / PHI:** US patient-privacy law / identifiable patient data.
- **Clinical decision support (CDS):** software that helps with clinical
  choices.
- **Agentic AI:** AI that takes actions across systems.
- **Resident:** a doctor in specialty training after medical school.
- **CME / CPD:** continuing medical education / professional development;
  the ongoing training doctors must do.

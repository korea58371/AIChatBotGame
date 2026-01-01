# Gemini API Pricing (2025 Reference)

**Last Updated:** 2025-12-31
**Source:** [Google AI Studio Pricing](https://ai.google.dev/pricing)

## Overview

| Tier | Description | Key Features |
| :--- | :--- | :--- |
| **Free** | For developers and small projects. | • Limited access to models<br>• Free input & output tokens<br>• Used to improve products |
| **Paid** | For production applications. | • Higher rate limits<br>• Context caching<br>• Batch API (50% off)<br>• **Content NOT used to improve products** |
| **Enterprise** | For large-scale deployments. | • Dedicated support<br>• Advanced security & compliance<br>• Provisioned throughput<br>• Powered by Vertex AI |

---

## Gemini 3 Series (Preview)

### Gemini 3 Pro Preview
*`gemini-3-pro-preview`* - The best model for multimodal understanding, agentic tasks, and vibe-coding.

#### Standard
| Metric | Free Tier | Paid Tier (per 1M tokens) |
| :--- | :--- | :--- |
| **Input** | N/A | **$2.00** (<= 200k)<br>**$4.00** (> 200k) |
| **Output** | N/A | **$12.00** (<= 200k)<br>**$18.00** (> 200k) |
| **Context Caching** | N/A | **$0.20** / **$0.40** (Load)<br>**$4.50** / hr (Storage) |
| **Search Grounding** | N/A | 5k free/mo, then $14/1k |

#### Batch
| Metric | Free Tier | Paid Tier (per 1M tokens) |
| :--- | :--- | :--- |
| **Input** | N/A | **$1.00** (<= 200k)<br>**$2.00** (> 200k) |
| **Output** | N/A | **$6.00** (<= 200k)<br>**$9.00** (> 200k) |

*Grounding billing starts Jan 5, 2026.*

### Gemini 3 Flash Preview
*`gemini-3-flash-preview`* - Built for speed, superior search, and grounding.

#### Standard
| Metric | Free Tier | Paid Tier (per 1M tokens) |
| :--- | :--- | :--- |
| **Input** | Free | **$0.50** (Text/Img/Vid)<br>**$1.00** (Audio) |
| **Output** | Free | **$3.00** |
| **Caching** | Free | **$0.05** / **$1.00** (Storage) |

#### Batch
| Metric | Free Tier | Paid Tier (per 1M tokens) |
| :--- | :--- | :--- |
| **Input** | N/A | **$0.25** |
| **Output** | N/A | **$1.50** |

### Gemini 3 Pro Image Preview
*`gemini-3-pro-image-preview`*

| Metric | Paid Tier |
| :--- | :--- |
| **Input** | **$2.00** (Text/Image) |
| **Output** | **$12.00** (Text)<br>**$120.00** (Images - ~$0.134/image) |

---

## Gemini 2.5 Series

### Gemini 2.5 Pro
*`gemini-2.5-pro`* - State-of-the-art multipurpose model for coding and complex reasoning.

#### Standard
| Metric | Free Tier | Paid Tier (per 1M tokens) |
| :--- | :--- | :--- |
| **Input** | Free | **$1.25** (<= 200k)<br>**$2.50** (> 200k) |
| **Output** | Free | **$10.00** (<= 200k)<br>**$15.00** (> 200k) |
| **Caching** | N/A | **$0.125** / **$0.25** (Load)<br>**$4.50** / hr (Storage) |

#### Batch
| Metric | Paid Tier (per 1M tokens) |
| :--- | :--- |
| **Input** | **$0.625** (<= 200k) |
| **Output** | **$5.00** (<= 200k) |

### Gemini 2.5 Flash
*`gemini-2.5-flash`* - Hybrid reasoning, 1M context, thinking budgets.

#### Standard
| Metric | Free Tier | Paid Tier (per 1M tokens) |
| :--- | :--- | :--- |
| **Input** | Free | **$0.30** |
| **Output** | Free | **$2.50** |
| **Caching** | N/A | **$0.03** (Load)<br>**$1.00** / hr (Storage) |

#### Batch
| Metric | Paid Tier (per 1M tokens) |
| :--- | :--- |
| **Input** | **$0.15** |
| **Output** | **$1.25** |

### Gemini 2.5 Flash-Lite
*`gemini-2.5-flash-lite`* - Most cost-effective, built for scale.

#### Standard
| Metric | Free Tier | Paid Tier (per 1M tokens) |
| :--- | :--- | :--- |
| **Input** | Free | **$0.10** |
| **Output** | Free | **$0.40** |
| **Caching** | N/A | **$0.01** (Load)<br>**$1.00** / hr (Storage) |

#### Batch
| Metric | Paid Tier (per 1M tokens) |
| :--- | :--- |
| **Input** | **$0.05** |
| **Output** | **$0.20** |

### Special 2.5 Models
- **Native Audio (Live API):** Input $0.50 (Text) / $3.00 (Audio/Video) | Output $2.00 (Text) / $12.00 (Audio)
- **Flash Image:** Input $0.30 | Output $0.039/image
- **Flash TTS:** Input $0.50 | Output $10.00 (Audio)
- **Pro TTS:** Input $1.00 | Output $20.00 (Audio)
- **Computer Use:** Input $1.25 | Output $10.00

---

## Gemini 2.0 Series

### Gemini 2.0 Flash
*`gemini-2.0-flash`* - Balanced multimodal, agents.

#### Standard
| Metric | Free Tier | Paid Tier (per 1M tokens) |
| :--- | :--- | :--- |
| **Input** | Free | **$0.10** (Text/Img)<br>**$0.70** (Audio) |
| **Output** | Free | **$0.40** |
| **Caching** | Free | **$0.025** (Load)<br>**$1.00** / hr (Storage) |

### Gemini 2.0 Flash-Lite
*`gemini-2.0-flash-lite`*

#### Standard
| Metric | Freed Tier | Paid Tier (per 1M tokens) |
| :--- | :--- | :--- |
| **Input** | Free | **$0.075** |
| **Output** | Free | **$0.30** |

---

## Imagen & Veo (Media Generation)

### Imagen 4 (Preview)
| Model | Price per Device |
| :--- | :--- |
| **Fast** | $0.02 |
| **Standard** | $0.04 |
| **Ultra** | $0.06 |

### Veo 3.1 (Video)
| Model | Price per Second |
| :--- | :--- |
| **Standard** | $0.40 |
| **Fast** | $0.15 |

---

## Tools Pricing

| Tool | Pricing (Paid) |
| :--- | :--- |
| **Google Search** | 1,500 free RPD, then **$35** / 1,000 queries |
| **Google Maps** | 1,500 free RPD (10k for Pro), then **$25** / 1,000 queries |
| **Code Execution** | Free |
| **File Search** | vector DB at embedding cost (**$0.15**/1M) |

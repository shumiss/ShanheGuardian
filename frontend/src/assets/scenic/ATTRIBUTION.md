# Scenic image provenance

This directory contains locally optimized image derivatives used by the
competition demo. The six homepage hero images are encoded as 2560 x 1440
WebP assets so the roadshow does not depend on third-party image hosts.

| Local asset | Local source candidate | Reference index |
| --- | --- | --- |
| `fanjingshan.webp` | `fanjingshan-wiki.jpg` | [Wikimedia Commons: Mount Fanjing](https://commons.wikimedia.org/wiki/Category:Mount_Fanjing) |
| `huangguoshu.webp` | `huangguoshu-wiki.jpg` | [Wikimedia Commons: Huangguoshu Waterfall](https://commons.wikimedia.org/wiki/Category:Huangguoshu_Waterfall) |
| `libo.webp` | `libo-wiki.jpg` | [Wikimedia Commons: Xiaoqikong.JPG](https://commons.wikimedia.org/wiki/File:Xiaoqikong.JPG) |
| `xijiang.webp` | `xijiang-wiki.jpg` | [Wikimedia Commons: Leishan County / Xijiang Qianhu Miaozhai](https://commons.wikimedia.org/wiki/Category:Leishan_County) |
| `wanfenglin.webp` | `wanfenglin-wiki.jpg` | [Wikimedia Commons: WanFengLin-ShangNaHui2025-08.jpg](https://commons.wikimedia.org/wiki/File:WanFengLin-ShangNaHui2025-08.jpg) |
| `zhijin.webp` | `zhijin-wiki.jpg` | [Wikimedia Commons: Zhijin Cave](https://commons.wikimedia.org/wiki/Category:Zhijin_Cave) |
| `qingyan.webp` | Legacy local demo asset | Replace or document at file-page level before public distribution. |

## Usage notes

- The source-candidate names above record the local processing chain. The
  temporary source-candidate directory is intentionally not shipped.
- Wikimedia Commons contains files under different licenses. Before a public
  or commercial release, confirm the exact file page, author, license and
  attribution wording for every bundled image.
- Images returned dynamically through `/api/scenic-photo` come from AMap POI
  responses. They are displayed at runtime and are not redistributed as local
  project assets. Their use remains subject to the AMap platform terms.
- For a production deployment, prefer project-owned photography or a fully
  documented licensed media library.

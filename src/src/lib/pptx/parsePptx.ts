import JSZip from 'jszip'

export interface ParsedSlide {
  title: string
  description: string
  images: { blob: Blob; filename: string }[]
}

/**
 * Parse a PPTX file and extract slides as step data.
 * Each slide becomes a step with title (first text block), description (remaining text), and images.
 */
export async function parsePptxToSteps(file: File): Promise<ParsedSlide[]> {
  const zip = await JSZip.loadAsync(file)

  // Find all slide XML files and sort by slide number
  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/)![1])
      const numB = parseInt(b.match(/slide(\d+)\.xml/)![1])
      return numA - numB
    })

  const slides: ParsedSlide[] = []

  for (const slideFile of slideFiles) {
    const slideNum = slideFile.match(/slide(\d+)\.xml/)![1]

    // Parse slide XML for text
    const xmlContent = await zip.files[slideFile].async('string')
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlContent, 'application/xml')

    // Extract all text nodes (<a:t> elements)
    const textNodes = doc.getElementsByTagNameNS(
      'http://schemas.openxmlformats.org/drawingml/2006/main',
      't'
    )

    // Group text by shape (each <p:sp> or <p:txBody> is a separate text block)
    const textBlocks: string[] = []
    const txBodies = doc.getElementsByTagNameNS(
      'http://schemas.openxmlformats.org/drawingml/2006/main',
      'txBody'
    )

    // Fallback: if no txBody found, collect from <a:t> directly
    if (txBodies.length === 0) {
      const allText: string[] = []
      for (let i = 0; i < textNodes.length; i++) {
        const text = textNodes[i].textContent?.trim()
        if (text) allText.push(text)
      }
      if (allText.length > 0) textBlocks.push(allText.join(' '))
    } else {
      for (let i = 0; i < txBodies.length; i++) {
        const body = txBodies[i]
        const paragraphs = body.getElementsByTagNameNS(
          'http://schemas.openxmlformats.org/drawingml/2006/main',
          'p'
        )
        const lines: string[] = []
        for (let j = 0; j < paragraphs.length; j++) {
          const tNodes = paragraphs[j].getElementsByTagNameNS(
            'http://schemas.openxmlformats.org/drawingml/2006/main',
            't'
          )
          const lineText: string[] = []
          for (let k = 0; k < tNodes.length; k++) {
            const t = tNodes[k].textContent?.trim()
            if (t) lineText.push(t)
          }
          if (lineText.length > 0) lines.push(lineText.join(''))
        }
        const blockText = lines.join('\n').trim()
        if (blockText) textBlocks.push(blockText)
      }
    }

    // First non-empty text block = title, rest = description
    const title = textBlocks[0] || `Slide ${slideNum}`
    const description = textBlocks.slice(1).join('\n\n')

    // Parse slide relationships to find image references
    const relsFile = `ppt/slides/_rels/slide${slideNum}.xml.rels`
    const images: { blob: Blob; filename: string }[] = []

    if (zip.files[relsFile]) {
      const relsXml = await zip.files[relsFile].async('string')
      const relsDoc = parser.parseFromString(relsXml, 'application/xml')
      const relationships = relsDoc.getElementsByTagName('Relationship')

      for (let i = 0; i < relationships.length; i++) {
        const rel = relationships[i]
        const type = rel.getAttribute('Type') || ''
        const target = rel.getAttribute('Target') || ''

        // Image relationship type
        if (type.includes('/image') && target) {
          // Target is relative like ../media/image1.png
          const mediaPath = target.startsWith('..')
            ? 'ppt/' + target.replace('../', '')
            : target.startsWith('/')
              ? target.slice(1)
              : 'ppt/slides/' + target

          if (zip.files[mediaPath]) {
            const blob = await zip.files[mediaPath].async('blob')
            const filename = mediaPath.split('/').pop() || `image${i}.png`
            images.push({ blob, filename })
          }
        }
      }
    }

    slides.push({ title, description, images })
  }

  return slides
}

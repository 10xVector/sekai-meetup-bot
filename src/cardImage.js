const { createCanvas, registerFont, loadImage } = require('canvas');
registerFont(__dirname + '/../fonts/NotoSansJP-Regular.ttf', { family: 'NotoSansJP' });

// Optionally, register a custom font here if you want
// registerFont('path/to/font.ttf', { family: 'CustomFont' });

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  // Split by both spaces and newlines
  const words = text.split(/\s+/);
  let lines = [];
  let currentLine = '';

  for (let word of words) {
    // If the word itself is longer than maxWidth, we need to split it
    if (ctx.measureText(word).width > maxWidth) {
      // If we have a current line, add it first
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      // Split the long word into characters
      let chars = word.split('');
      let tempWord = '';
      for (let char of chars) {
        if (ctx.measureText(tempWord + char).width <= maxWidth) {
          tempWord += char;
        } else {
          if (tempWord) lines.push(tempWord);
          tempWord = char;
        }
      }
      if (tempWord) lines.push(tempWord);
      continue;
    }

    // Test if adding this word would exceed the maxWidth
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  // Draw all lines
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, y + i * lineHeight);
  }

  return y + lines.length * lineHeight;
}

function wrapTextWithBold(ctx, text, x, y, maxWidth, lineHeight) {
  // Check if text contains bold formatting
  if (text.includes('**')) {
    // Split text by bold markers
    const parts = text.split(/(\*\*.*?\*\*)/g);
    let currentX = x;
    let currentY = y;
    
    for (const part of parts) {
      if (part.startsWith('**') && part.endsWith('**')) {
        // Bold text - use larger font for "Today's small talk"
        const boldText = part.slice(2, -2);
        if (boldText.includes("Today's small talk")) {
          ctx.font = '56px NotoSansJP'; // Much larger font for the title
          // Add stroke/outline to make it appear bolder
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 2;
          ctx.strokeText(boldText, currentX, currentY);
          ctx.fillText(boldText, currentX, currentY);
        } else {
          ctx.font = 'bold 26px NotoSansJP'; // Regular bold font
          ctx.fillText(boldText, currentX, currentY);
        }
        currentX += ctx.measureText(boldText).width;
        ctx.font = '26px NotoSansJP'; // Reset to normal font
        ctx.lineWidth = 1; // Reset line width
      } else if (part.trim()) {
        // Normal text
        ctx.fillText(part, currentX, currentY);
        currentX += ctx.measureText(part).width;
      }
    }
    return y + lineHeight;
  } else {
    // No bold formatting, use regular wrapText
    return wrapText(ctx, text, x, y, maxWidth, lineHeight);
  }
}

function processBoldBlock(ctx, block, x, y, maxWidth, lineHeight) {
  // Remove all ** markers and process the entire block as bold
  const cleanBlock = block.replace(/\*\*/g, '');
  const lines = cleanBlock.split('\n');
  
  for (const line of lines) {
    if (line.trim()) {
      ctx.font = 'bold 26px NotoSansJP';
      y = wrapText(ctx, line, x, y, maxWidth, lineHeight);
      ctx.font = '26px NotoSansJP'; // Reset to normal font
    }
  }
  return y;
}

module.exports = async function generateCardImage(smalltalkText, backgroundImagePath = null) {
  // Remove emojis and rename 'Fill-in-the-Blank' to 'Example'
  let processedText = smalltalkText
    .replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu, '') // Remove emojis
    .replace(/❓\s*Question:/g, '**Today\'s small talk**')
    .replace(/JP:\s*/g, '') // Remove JP: prefix
    .replace(/Romaji:\s*/g, '') // Remove Romaji: prefix
    .replace(/EN:\s*/g, '') // Remove EN: prefix
    .replace(/✍️\s*Fill-in-the-Blank:\s*/g, '') // Remove Fill-in-the-Blank title
    .replace(/\n\n💬\s*Example Answer:[\s\S]*?(?=\n\n|$)/g, '') // Remove entire Example Answer section
    .replace(/\*\*EN: /g, '**EN: ') // Ensure bold formatting for question section
    .replace(/\*\*JP: /g, '**JP: ')
    .replace(/\*\*Romaji: /g, '**Romaji: ');

  // Parse the processedText into blocks
  const blocks = processedText.split(/\n\n/);
  
  // Remove ** markers from the question block (first block)
  if (blocks.length > 0) {
    blocks[0] = blocks[0].replace(/\*\*/g, '');
  }

  const minWidth = 800;
  const maxWidth = 1200;
  const baseHeight = 800; // Increased base height
  const leftPad = 50;
  const titleHeight = 48;
  const blockSpacing = 10; // Reduced spacing between blocks from 20 to 10
  const lineHeight = 36; // Increased line height for better readability

  // Calculate header height based on background image if provided
  let headerHeight = Math.floor(baseHeight / 4); // Default header height
  if (backgroundImagePath) {
    try {
      const img = await loadImage(backgroundImagePath);
      // Calculate header height to fit the full image width while maintaining aspect ratio
      const scale = Math.min(maxWidth, Math.max(minWidth, 800)) / img.width;
      headerHeight = Math.floor(img.height * scale);
    } catch (err) {
      console.error('Failed to load background image for height calculation:', err);
      // Keep default header height
    }
  }

  // --- First pass: measure required width and height ---
  // Create a temp canvas for measurement
  const tempCanvas = createCanvas(minWidth, baseHeight);
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.font = '26px NotoSansJP';

  // Find the longest line to determine width
  let maxLineWidth = 0;
  for (const block of blocks) {
    const lines = block.split('\n');
    for (const line of lines) {
      const width = tempCtx.measureText(line).width;
      maxLineWidth = Math.max(maxLineWidth, width);
    }
  }

  // Calculate final width (add padding and ensure it's within bounds)
  const contentWidth = Math.min(Math.max(maxLineWidth + 2 * leftPad, minWidth), maxWidth);
  const width = contentWidth;

  // Measure height with proper text wrapping
  let y = headerHeight + 50 + titleHeight;
  for (const block of blocks) {
    const lines = block.split('\n');
    for (const line of lines) {
      const words = line.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (tempCtx.measureText(testLine).width <= contentWidth - 2 * leftPad) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            y += lineHeight;
            currentLine = word;
          } else {
            // Handle single words that are too long
            y += lineHeight;
            currentLine = '';
          }
        }
      }
      if (currentLine) {
        y += lineHeight;
      }
    }
    y += blockSpacing;
  }

  // Add space for header, title, and border
  let totalHeight = y + 30; // Reduced bottom padding from 50 to 30
  if (totalHeight < baseHeight) totalHeight = baseHeight;

  // --- Now create the real canvas ---
  const canvas = createCanvas(width, totalHeight);
  const ctx = canvas.getContext('2d');

  // Header background - either image or default blue
  if (backgroundImagePath) {
    try {
      // Load and draw background image in header
      const img = await loadImage(backgroundImagePath);
      
      // Scale image to fit full header width while maintaining aspect ratio
      const scale = width / img.width;
      const scaledHeight = img.height * scale;
      
      // Draw the entire image in the header area
      ctx.drawImage(img, 0, 0, width, headerHeight);
    } catch (err) {
      console.error('Failed to load background image:', err);
      // Fallback to default blue background
      ctx.fillStyle = '#A3C9F9';
      ctx.fillRect(0, 0, width, headerHeight);
    }
  } else {
    // Default blue background
    ctx.fillStyle = '#A3C9F9';
    ctx.fillRect(0, 0, width, headerHeight);

    // --- Clouds in the header (behind mascot) ---
    function drawCloud(cx, cy, scale = 1) {
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 32 * scale, 20 * scale, 0, 0, 2 * Math.PI);
      ctx.ellipse(cx - 22 * scale, cy + 6 * scale, 18 * scale, 14 * scale, 0, 0, 2 * Math.PI);
      ctx.ellipse(cx + 22 * scale, cy + 6 * scale, 18 * scale, 14 * scale, 0, 0, 2 * Math.PI);
      ctx.ellipse(cx, cy + 12 * scale, 22 * scale, 14 * scale, 0, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    drawCloud(width / 2 - 120, headerHeight / 2 - 30, 1.1);
    drawCloud(width / 2 + 100, headerHeight / 2 - 40, 0.9);
    drawCloud(width / 2 - 40, headerHeight / 2 + 50, 0.7);
  }

  // Main content background (warm light yellow)
  ctx.fillStyle = '#FFF9E3';
  ctx.fillRect(0, headerHeight, width, totalHeight - headerHeight);

  // --- Main Content Section ---
  y = headerHeight + 80; // Increased top padding from 50 to 80
  ctx.font = '26px NotoSansJP';
  for (const block of blocks) {
    ctx.fillStyle = '#222';
    
    // Check if this is the question block (first block)
    if (blocks.indexOf(block) === 0) {
      console.log('Processing question block:', block);
      // Process question block - handle title and content separately
      const lines = block.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          if (line.includes("Today's small talk")) {
            // Special formatting for title
            console.log('Processing title line:', line);
            ctx.font = '56px NotoSansJP'; // Large font for the title
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.strokeText(line, leftPad, y);
            ctx.fillText(line, leftPad, y);
            y += lineHeight;
            y += 40; // Extra padding after the title
            ctx.font = '26px NotoSansJP'; // Reset to normal font
            ctx.lineWidth = 1; // Reset line width
          } else {
            // Bold formatting for question content
            console.log('Processing question line:', line);
            ctx.font = '32px NotoSansJP'; // Larger font to make it appear bolder
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.strokeText(line, leftPad, y);
            ctx.fillText(line, leftPad, y);
            y += lineHeight;
          }
        }
      }
      ctx.font = '26px NotoSansJP'; // Reset to normal font after question block
      ctx.lineWidth = 1; // Reset line width
    } else {
      // Process normal text block (fill-in-the-blank)
      const lines = block.split('\n');
      for (const line of lines) {
        y = wrapTextWithBold(ctx, line, leftPad, y, contentWidth - 2 * leftPad, lineHeight);
      }
    }
    y += blockSpacing;
  }

  return canvas.toBuffer('image/png');
}; 
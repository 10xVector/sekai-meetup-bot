const { createCanvas, registerFont, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
registerFont(__dirname + '/../fonts/NotoSansJP-Regular.ttf', { family: 'NotoSansJP' });

// Function to get a random background image from the backgrounds folder
function getRandomBackgroundImage() {
  try {
    const backgroundsDir = path.join(__dirname, 'backgrounds');
    const files = fs.readdirSync(backgroundsDir);
    const backgroundFiles = files.filter(file => file.startsWith('background-') && file.endsWith('.png'));
    
    if (backgroundFiles.length === 0) {
      return null; // No background images found
    }
    
    // Randomly select a background image
    const randomFile = backgroundFiles[Math.floor(Math.random() * backgroundFiles.length)];
    return path.join(backgroundsDir, randomFile);
  } catch (err) {
    console.error('Error reading backgrounds directory:', err);
    return null;
  }
}

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
  // If no background image is provided, use a random one from the backgrounds folder
  if (!backgroundImagePath) {
    backgroundImagePath = getRandomBackgroundImage();
  }

  // Remove emojis and rename 'Fill-in-the-Blank' to 'Example'
  let processedText = smalltalkText
    .replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu, '') // Remove emojis
    .replace(/❓\s*Question:/g, "**Today's small talk**")
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
  if (blocks.length > 0) {
    blocks[0] = blocks[0].replace(/\*\*/g, '');
  }

  const minWidth = 800;
  const maxWidth = 1200;
  const leftPad = 50;
  const titleHeight = 48;
  const blockSpacing = 10;
  const lineHeight = 36;
  const baseHeight = 800;

  // 1. Measure text to determine required width
  const tempCanvas = createCanvas(minWidth, baseHeight);
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.font = '26px NotoSansJP';
  let maxLineWidth = 0;
  for (const block of blocks) {
    const lines = block.split('\n');
    for (const line of lines) {
      const width = tempCtx.measureText(line).width;
      maxLineWidth = Math.max(maxLineWidth, width);
    }
  }
  const contentWidth = Math.min(Math.max(maxLineWidth + 2 * leftPad, minWidth), maxWidth);
  const width = contentWidth;

  // 2. Load background and calculate header height based on width
  let headerHeight = 200;
  if (backgroundImagePath) {
    try {
      const img = await loadImage(backgroundImagePath);
      const scale = width / img.width;
      headerHeight = img.height * scale;
    } catch (err) {
      console.error('Failed to load background image for height calculation:', err);
    }
  }

  // 3. Measure height with proper text wrapping
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
  let totalHeight = y + 70;
  if (totalHeight < baseHeight) totalHeight = baseHeight;

  // 4. Create the real canvas
  const canvas = createCanvas(width, totalHeight);
  const ctx = canvas.getContext('2d');

  // Draw header background
  if (backgroundImagePath) {
    try {
      const img = await loadImage(backgroundImagePath);
      ctx.drawImage(img, 0, 0, width, headerHeight);
    } catch (err) {
      ctx.fillStyle = '#A3C9F9';
      ctx.fillRect(0, 0, width, headerHeight);
    }
  } else {
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

  // Main content background
  ctx.fillStyle = '#FFF9E3';
  ctx.fillRect(0, headerHeight, width, totalHeight - headerHeight);

  // --- Main Content Section ---
  y = headerHeight + 70;
  ctx.font = '26px NotoSansJP';
  const questionSectionExtraSpacing = 10;
  for (const block of blocks) {
    ctx.fillStyle = '#222';
    if (blocks.indexOf(block) === 0) {
      const lines = block.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          if (line.includes("Today's small talk")) {
            ctx.font = '56px NotoSansJP';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.strokeText(line, leftPad, y);
            ctx.fillText(line, leftPad, y);
            y += lineHeight + questionSectionExtraSpacing;
            y += 40;
            ctx.font = '26px NotoSansJP';
            ctx.lineWidth = 1;
          } else {
            ctx.font = '32px NotoSansJP';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.strokeText(line, leftPad, y);
            ctx.fillText(line, leftPad, y);
            y += lineHeight + questionSectionExtraSpacing;
          }
        }
      }
      ctx.font = '26px NotoSansJP';
      ctx.lineWidth = 1;
    } else {
      const lines = block.split('\n');
      for (const line of lines) {
        y = wrapTextWithBold(ctx, line, leftPad, y, contentWidth - 2 * leftPad, lineHeight);
      }
    }
    y += blockSpacing;
  }

  return canvas.toBuffer('image/png');
}; 
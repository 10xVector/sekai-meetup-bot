const { createCanvas, registerFont } = require('canvas');
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

module.exports = function generateCardImage(smalltalkText) {
  // Remove emojis and rename 'Fill-in-the-Blank' to 'Example'
  let processedText = smalltalkText
    .replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu, '') // Remove emojis
    .replace(/✍️\s*Fill-in-the-Blank:/g, 'Example:');

  // Parse the processedText into blocks
  const blocks = processedText.split(/\n\n/);
  const minWidth = 800;
  const maxWidth = 1200;
  const baseHeight = 800; // Increased base height
  const headerHeight = Math.floor(baseHeight / 4); // Reduced header proportion
  const leftPad = 50;
  const titleHeight = 48;
  const blockSpacing = 40; // Increased spacing between blocks
  const lineHeight = 36; // Increased line height for better readability

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
  let totalHeight = y + 50;
  if (totalHeight < baseHeight) totalHeight = baseHeight;

  // --- Now create the real canvas ---
  const canvas = createCanvas(width, totalHeight);
  const ctx = canvas.getContext('2d');

  // Header background (blue)
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

  // Main content background (warm light yellow)
  ctx.fillStyle = '#FFF9E3';
  ctx.fillRect(0, headerHeight, width, totalHeight - headerHeight);

  // --- Header Illustration: Earth Mascot with Happy Face ---
  const mascotRadius = 60;
  const mascotX = width / 2;
  const mascotY = headerHeight / 2 + 10;
  ctx.beginPath();
  ctx.arc(mascotX, mascotY, mascotRadius, 0, 2 * Math.PI);
  ctx.closePath();
  ctx.fillStyle = '#6A9CFD';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#4CB050';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(mascotX - 20, mascotY, 18, 10, Math.PI / 6, 0, 2 * Math.PI);
  ctx.ellipse(mascotX + 15, mascotY + 20, 12, 8, -Math.PI / 4, 0, 2 * Math.PI);
  ctx.fillStyle = '#4CB050';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(mascotX - 18, mascotY - 10, 6, 0, 2 * Math.PI);
  ctx.arc(mascotX + 18, mascotY - 10, 6, 0, 2 * Math.PI);
  ctx.fillStyle = '#222';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(mascotX - 16, mascotY - 12, 2, 0, 2 * Math.PI);
  ctx.arc(mascotX + 20, mascotY - 12, 2, 0, 2 * Math.PI);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(mascotX, mascotY + 5, 18, Math.PI / 8, Math.PI - Math.PI / 8);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#222';
  ctx.stroke();

  // "Sekai Meetup" text in header
  ctx.font = 'bold 48px NotoSansJP';
  ctx.fillStyle = '#222';
  ctx.textAlign = 'center';
  ctx.fillText('Sekai Meetup', width / 2, 55);
  ctx.textAlign = 'start';

  // --- Main Content Section ---
  y = headerHeight + 50;
  ctx.font = '26px NotoSansJP';
  for (const block of blocks) {
    const lines = block.split('\n');
    for (const line of lines) {
      ctx.fillStyle = '#222';
      y = wrapText(ctx, line, leftPad, y, contentWidth - 2 * leftPad, lineHeight);
    }
    y += blockSpacing;
  }

  return canvas.toBuffer('image/png');
}; 
const { createCanvas, registerFont } = require('canvas');
registerFont(__dirname + '/../fonts/NotoSansJP-Regular.ttf', { family: 'NotoSansJP' });

// Optionally, register a custom font here if you want
// registerFont('path/to/font.ttf', { family: 'CustomFont' });

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let lines = [];
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      lines.push(line);
      line = words[n] + ' ';
    } else {
      line = testLine;
    }
  }
  lines.push(line);
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
  const width = 800;
  const baseHeight = 600;
  const headerHeight = Math.floor(baseHeight / 3);
  const leftPad = 50;
  const contentWidth = width - 2 * leftPad;
  const titleHeight = 48;
  const blockSpacing = 32;
  const lineHeight = 32;

  // --- First pass: measure required height ---
  // Create a temp canvas for measurement
  const tempCanvas = createCanvas(width, baseHeight);
  const tempCtx = tempCanvas.getContext('2d');
  let y = headerHeight + 50 + titleHeight; // Start after header and title
  tempCtx.font = '22px NotoSansJP';
  for (const block of blocks) {
    const lines = block.split('\n');
    for (let i = 0; i < lines.length; i++) {
      // Estimate wrapped lines
      let words = lines[i].split(' ');
      let line = '';
      for (let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + ' ';
        let metrics = tempCtx.measureText(testLine);
        let testWidth = metrics.width;
        if (testWidth > contentWidth && n > 0) {
          y += lineHeight;
          line = words[n] + ' ';
        } else {
          line = testLine;
        }
      }
      y += lineHeight; // Last line
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
  ctx.font = 'bold 40px NotoSansJP';
  ctx.fillStyle = '#222';
  ctx.textAlign = 'center';
  ctx.fillText('Sekai Meetup', width / 2, 55);
  ctx.textAlign = 'start';

  // Border around the whole card
  ctx.strokeStyle = '#FFC857';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, width - 40, totalHeight - 40);

  // --- Main Content Section ---
  y = headerHeight + 50;
  ctx.font = 'bold 32px NotoSansJP';
  ctx.fillStyle = '#222';
  ctx.fillText("Today's small talk", leftPad, y);
  y += titleHeight;
  ctx.font = '22px NotoSansJP';
  for (const block of blocks) {
    const lines = block.split('\n');
    for (let i = 0; i < lines.length; i++) {
      ctx.fillStyle = '#222';
      y = wrapText(ctx, lines[i], leftPad, y, contentWidth, lineHeight);
    }
    y += blockSpacing;
  }

  return canvas.toBuffer('image/png');
}; 
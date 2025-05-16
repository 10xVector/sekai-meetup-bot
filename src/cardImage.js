const { createCanvas, registerFont } = require('canvas');

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
  // Parse the smalltalkText into blocks
  const blocks = smalltalkText.split(/\n\n/);
  const width = 800;
  const height = 600;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Layout dimensions
  const headerHeight = Math.floor(height / 3);

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
  // Draw a few clouds at different positions
  drawCloud(width / 2 - 120, headerHeight / 2 - 30, 1.1);
  drawCloud(width / 2 + 100, headerHeight / 2 - 40, 0.9);
  drawCloud(width / 2 - 40, headerHeight / 2 + 50, 0.7);

  // Main content background (warm light yellow)
  ctx.fillStyle = '#FFF9E3';
  ctx.fillRect(0, headerHeight, width, height - headerHeight);

  // --- Header Illustration: Earth Mascot with Happy Face ---
  // Earth position and size (centered in header)
  const mascotRadius = 60;
  const mascotX = width / 2;
  const mascotY = headerHeight / 2 + 10;

  // Draw earth (circle)
  ctx.beginPath();
  ctx.arc(mascotX, mascotY, mascotRadius, 0, 2 * Math.PI);
  ctx.closePath();
  ctx.fillStyle = '#6A9CFD'; // Blue for water
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#4CB050'; // Green outline for land
  ctx.stroke();

  // Draw simple land shapes (just a couple of blobs)
  ctx.beginPath();
  ctx.ellipse(mascotX - 20, mascotY, 18, 10, Math.PI / 6, 0, 2 * Math.PI);
  ctx.ellipse(mascotX + 15, mascotY + 20, 12, 8, -Math.PI / 4, 0, 2 * Math.PI);
  ctx.fillStyle = '#4CB050';
  ctx.fill();

  // Draw happy face
  // Eyes
  ctx.beginPath();
  ctx.arc(mascotX - 18, mascotY - 10, 6, 0, 2 * Math.PI);
  ctx.arc(mascotX + 18, mascotY - 10, 6, 0, 2 * Math.PI);
  ctx.fillStyle = '#222';
  ctx.fill();
  // Eye highlights
  ctx.beginPath();
  ctx.arc(mascotX - 16, mascotY - 12, 2, 0, 2 * Math.PI);
  ctx.arc(mascotX + 20, mascotY - 12, 2, 0, 2 * Math.PI);
  ctx.fillStyle = '#fff';
  ctx.fill();
  // Smile
  ctx.beginPath();
  ctx.arc(mascotX, mascotY + 5, 18, Math.PI / 8, Math.PI - Math.PI / 8);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#222';
  ctx.stroke();

  // "Sekai Meetup" text in header
  ctx.font = 'bold 40px sans-serif';
  ctx.fillStyle = '#222';
  ctx.textAlign = 'center';
  ctx.fillText('Sekai Meetup', width / 2, 55);
  ctx.textAlign = 'start';

  // Border around the whole card
  ctx.strokeStyle = '#FFC857'; // Gold border
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, width - 40, height - 40);

  // --- Main Content Section ---
  let y = headerHeight + 50;
  const leftPad = 50;
  const contentWidth = width - 2 * leftPad;

  // Title
  ctx.font = 'bold 32px sans-serif';
  ctx.fillStyle = '#222';
  ctx.fillText("Today's small talk", leftPad, y);
  y += 48;

  // Draw each block (as in previous logic, but with more spacing)
  ctx.font = '22px sans-serif';
  for (const block of blocks) {
    const lines = block.split('\n');
    for (let i = 0; i < lines.length; i++) {
      ctx.fillStyle = '#222';
      y = wrapText(ctx, lines[i], leftPad, y, contentWidth, 32);
    }
    y += 32;
  }

  return canvas.toBuffer('image/png');
}; 
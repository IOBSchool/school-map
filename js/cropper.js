// シンプルな写真クロッパー：スライダーで拡大縮小、ドラッグで位置調整してから確定する
// 使い方: const blob = await Cropper.open(file, { aspect: 1, outW: 400, round: true });
//        blob が null ならキャンセルされたということ
window.Cropper = (function () {
  function open(file, opts) {
    const aspect = (opts && opts.aspect) || 1;
    const outW = (opts && opts.outW) || 800;
    const outH = Math.round(outW / aspect);

    return new Promise(async (resolve) => {
      let bmp;
      try { bmp = await createImageBitmap(file); } catch { resolve(null); return; }

      const viewW = Math.min(300, Math.round(window.innerWidth * 0.8));
      const viewH = Math.round(viewW / aspect);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      const overlay = document.createElement('div');
      overlay.className = 'cropper-overlay';
      overlay.innerHTML = `
        <div class="cropper-box">
          <p class="cropper-title">写真の位置と大きさを調整できます</p>
          <div class="cropper-frame${opts && opts.round ? ' round' : ''}" style="width:${viewW}px;height:${viewH}px">
            <canvas width="${Math.round(viewW * dpr)}" height="${Math.round(viewH * dpr)}" style="width:${viewW}px;height:${viewH}px"></canvas>
          </div>
          <input type="range" class="cropper-zoom" min="0" max="1" step="0.01" value="0">
          <div class="cropper-actions">
            <button type="button" class="btn sub" data-cancel>キャンセル</button>
            <button type="button" class="btn" data-ok>この写真にする</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      const canvas = overlay.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      const zoomInput = overlay.querySelector('.cropper-zoom');

      const minScale = Math.max(viewW / bmp.width, viewH / bmp.height);
      const maxScale = minScale * 4;
      let scale = minScale, ox = 0, oy = 0;

      function clampOffset() {
        const w = bmp.width * scale, h = bmp.height * scale;
        const maxX = Math.max(0, (w - viewW) / 2), maxY = Math.max(0, (h - viewH) / 2);
        ox = Math.min(maxX, Math.max(-maxX, ox));
        oy = Math.min(maxY, Math.max(-maxY, oy));
      }
      function draw() {
        ctx.clearRect(0, 0, viewW, viewH);
        const w = bmp.width * scale, h = bmp.height * scale;
        ctx.drawImage(bmp, viewW / 2 - w / 2 + ox, viewH / 2 - h / 2 + oy, w, h);
      }
      clampOffset();
      draw();

      zoomInput.addEventListener('input', () => {
        scale = minScale + (maxScale - minScale) * Number(zoomInput.value);
        clampOffset();
        draw();
      });

      let dragging = null;
      canvas.addEventListener('pointerdown', (e) => {
        dragging = { x: e.clientX, y: e.clientY, ox, oy };
        canvas.setPointerCapture(e.pointerId);
      });
      canvas.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        ox = dragging.ox + (e.clientX - dragging.x);
        oy = dragging.oy + (e.clientY - dragging.y);
        clampOffset();
        draw();
      });
      const endDrag = () => { dragging = null; };
      canvas.addEventListener('pointerup', endDrag);
      canvas.addEventListener('pointercancel', endDrag);

      function cleanup() {
        overlay.remove();
        if (bmp.close) bmp.close();
      }
      overlay.querySelector('[data-cancel]').addEventListener('click', () => { cleanup(); resolve(null); });
      overlay.querySelector('[data-ok]').addEventListener('click', () => {
        const w = bmp.width * scale, h = bmp.height * scale;
        const srcW = viewW / scale, srcH = viewH / scale;
        const srcX = Math.max(0, Math.min(bmp.width - srcW, (w / 2 - viewW / 2 - ox) / scale));
        const srcY = Math.max(0, Math.min(bmp.height - srcH, (h / 2 - viewH / 2 - oy) / scale));
        const out = document.createElement('canvas');
        out.width = outW;
        out.height = outH;
        out.getContext('2d').drawImage(bmp, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
        out.toBlob((blob) => { cleanup(); resolve(blob); }, 'image/jpeg', 0.85);
      });
    });
  }
  return { open };
})();

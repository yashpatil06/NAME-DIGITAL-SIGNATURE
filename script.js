;(() => {
  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById('sigCanvas')
  const ctx = canvas.getContext('2d')

  const elText = document.getElementById('textInput')
  const elColor = document.getElementById('colorInput')
  const elWidth = document.getElementById('widthInput')
  const elBg = document.getElementById('bgInput')
  const elPoints = document.getElementById('pointsToggle')
  const elLabels = document.getElementById('labelsToggle')
  const btnDownload = document.getElementById('btnDownload')
  const btnEdit = document.getElementById('btnEdit')
  const btnHelp = document.getElementById('btnHelp')
  const editDialog = document.getElementById('editDialog')
  const helpDialog = document.getElementById('helpDialog')
  const editForm = document.getElementById('editForm')
  const btnApply = document.getElementById('btnApply')
  const widthValue = document.getElementById('widthValue')
  const loadingIndicator = document.getElementById('loadingIndicator')
  const canvasOverlay = document.querySelector('.canvas-overlay')

  // Helper function to close dialogs with fallback
  function closeDialog(dialogId) {
    const dialog = document.getElementById(dialogId)
    if (typeof dialog.close === 'function') {
      dialog.close()
    } else {
      dialog.style.display = 'none'
      dialog.removeAttribute('open')
    }
  }

  // Make it global for HTML onclick handlers
  window.closeDialog = closeDialog

  // QWERTY positions (A–Z) in "keyboard units".
  // Row offsets roughly match a physical keyboard stagger.
  const keyUnits = (() => {
    const top = 'qwertyuiop'.split('')
    const mid = 'asdfghjkl'.split('')
    const bot = 'zxcvbnm'.split('')

    /** @type {Record<string, {x:number,y:number}>} */
    const map = {}

    const yGap = 1
    const xGap = 1

    top.forEach((k, i) => (map[k] = { x: i * xGap, y: 0 * yGap }))
    mid.forEach((k, i) => (map[k] = { x: (i + 0.35) * xGap, y: 1 * yGap }))
    bot.forEach((k, i) => (map[k] = { x: (i + 0.85) * xGap, y: 2 * yGap }))

    return map
  })()

  /** Animation + UI state */
  let rafId = 0
  let hideKeyboardTimer = 0
  let keyboardVisible = true
  let lastDrawnText = ''

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n))
  }

  function bgColorFromSelect(value) {
    if (value === 'black') return '#000000'
    if (value === 'white') return '#ffffff'
    return null // transparent
  }

  function normalizeText(raw) {
    return (raw || '').toLowerCase().replace(/[^a-z]/g, '') // ignore non letters for deterministic signature
  }

  function getUnitPoints(text) {
    /** @type {{x:number,y:number,ch:string}[]} */
    const pts = []
    for (const ch of text) {
      const pos = keyUnits[ch]
      if (!pos) continue
      pts.push({ x: pos.x, y: pos.y, ch })
    }
    return pts
  }

  function getKeyboardBoundsUnits() {
    // Includes q..p row etc; units are 0..9 on top row and staggered below.
    // These bounds are used only for drawing a keyboard overlay.
    return {
      minX: 0,
      maxX: 9,
      minY: 0,
      maxY: 2,
    }
  }

  function getKeyboardTransform() {
    // Stable mapping: ensures keyboard overlay, points, and signature all align.
    const pad = 56
    const w = canvas.width
    const h = canvas.height

    const b = getKeyboardBoundsUnits()
    const availableW = Math.max(1, w - pad * 2)
    const availableH = Math.max(1, h - pad * 2)
    const scaleX = availableW / (b.maxX - b.minX)
    const scaleY = availableH / (b.maxY - b.minY)
    const scale = Math.min(scaleX, scaleY)

    const contentW = (b.maxX - b.minX) * scale
    const contentH = (b.maxY - b.minY) * scale
    const offsetX = (w - contentW) / 2
    const offsetY = (h - contentH) / 2

    return {
      scale,
      offsetX,
      offsetY,
      bounds: b,
    }
  }

  function mapUnitToCanvas(x, y, tfm = getKeyboardTransform()) {
    return {
      x: tfm.offsetX + (x - tfm.bounds.minX) * tfm.scale,
      y: tfm.offsetY + (y - tfm.bounds.minY) * tfm.scale,
      scale: tfm.scale,
    }
  }

  function mapToCanvas(points) {
    // Convert unit points into canvas coordinates using the SAME transform as the keyboard overlay.
    if (points.length === 0) return { pts: [], bounds: null }
    const tfm = getKeyboardTransform()

    const mapped = points.map((p) => ({
      x: tfm.offsetX + (p.x - tfm.bounds.minX) * tfm.scale,
      y: tfm.offsetY + (p.y - tfm.bounds.minY) * tfm.scale,
      ch: p.ch,
    }))

    return { pts: mapped, bounds: tfm }
  }

  function drawKeyboardOverlay() {
    // Subtle background keyboard grid for explainability while typing.
    const bgValue = elBg.value
    const textColor = bgValue === 'white' ? '#000000' : '#ffffff'

    ctx.save()
    ctx.globalAlpha = 0.18
    ctx.strokeStyle = textColor
    ctx.lineWidth = 1

    const keyWUnits = 0.9
    const keyHUnits = 0.75
    const keys = Object.keys(keyUnits)
    const tfm = getKeyboardTransform()

    for (const ch of keys) {
      const u = keyUnits[ch]
      const p = mapUnitToCanvas(u.x, u.y, tfm)
      const keyW = keyWUnits * p.scale
      const keyH = keyHUnits * p.scale

      const x = p.x - keyW / 2
      const y = p.y - keyH / 2
      const r = Math.max(6, Math.min(12, p.scale * 0.12))

      // Rounded rect (manual)
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + keyW - r, y)
      ctx.quadraticCurveTo(x + keyW, y, x + keyW, y + r)
      ctx.lineTo(x + keyW, y + keyH - r)
      ctx.quadraticCurveTo(x + keyW, y + keyH, x + keyW - r, y + keyH)
      ctx.lineTo(x + r, y + keyH)
      ctx.quadraticCurveTo(x, y + keyH, x, y + keyH - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
      ctx.stroke()
    }

    ctx.globalAlpha = 0.35
    ctx.fillStyle = textColor
    ctx.font = '11px ui-sans-serif, system-ui, Segoe UI, Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const ch of keys) {
      const u = keyUnits[ch]
      const p = mapUnitToCanvas(u.x, u.y, tfm)
      ctx.fillText(ch.toUpperCase(), p.x, p.y)
    }

    ctx.restore()
  }

  function polylineLength(points) {
    let len = 0
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x
      const dy = points[i].y - points[i - 1].y
      len += Math.hypot(dx, dy)
    }
    return len
  }

  function drawPartialPolyline(points, maxLen) {
    if (points.length === 0) return
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)

    let travelled = 0
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]
      const b = points[i]
      const seg = Math.hypot(b.x - a.x, b.y - a.y)
      if (travelled + seg <= maxLen) {
        ctx.lineTo(b.x, b.y)
        travelled += seg
      } else {
        const remaining = maxLen - travelled
        const t = seg <= 0 ? 0 : clamp(remaining / seg, 0, 1)
        const x = a.x + (b.x - a.x) * t
        const y = a.y + (b.y - a.y) * t
        ctx.lineTo(x, y)
        break
      }
    }
    ctx.stroke()
  }

  function setCanvasBg(bgValue) {
    const c = bgColorFromSelect(bgValue)
    // Canvas element background affects on-screen only, not exported pixels.
    canvas.style.background = c ?? 'transparent'
  }

  function renderFrame({ signatureOnly = false } = {}) {
    const bgValue = elBg.value
    const bg = bgColorFromSelect(bgValue)
    setCanvasBg(bgValue)

    // True pixel clear
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Optional fill for export + for consistent visuals
    if (bg) {
      ctx.save()
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
    }

    if (!signatureOnly && keyboardVisible) {
      drawKeyboardOverlay()
    }

    const text = normalizeText(elText.value)
    const unitPts = getUnitPoints(text)
    const { pts } = mapToCanvas(unitPts)

    const width = clamp(Number(elWidth.value), 1, 40)
    const color = elColor.value || '#ffffff'

    // If empty, just show keyboard overlay (when visible) and blank canvas
    if (!text) return

    // Path
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    // Straight polyline render
    if (pts.length === 1) {
      ctx.beginPath()
      ctx.arc(pts[0].x, pts[0].y, Math.max(2, width / 2), 0, Math.PI * 2)
      ctx.stroke()
    } else if (pts.length > 1) {
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
      ctx.stroke()
    }
    ctx.restore()

    // Optional points
    if (!signatureOnly && elPoints.checked && pts.length) {
      ctx.save()
      ctx.fillStyle = color
      const r = Math.max(2, width * 0.45)
      for (const p of pts) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    // Optional labels
    if (!signatureOnly && elLabels.checked && pts.length) {
      ctx.save()
      ctx.fillStyle = bgValue === 'white' ? '#000000' : '#ffffff'
      ctx.font = '12px ui-sans-serif, system-ui, Segoe UI, Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      for (const p of pts) {
        ctx.fillText(p.ch.toUpperCase(), p.x, p.y - 8)
      }
      ctx.restore()
    }
  }

  function animateSignature() {
    cancelAnimationFrame(rafId)

    const text = normalizeText(elText.value)
    if (!text) {
      keyboardVisible = true
      renderFrame()
      return
    }

    // Show loading indicator
    canvasOverlay.classList.add('active')

    // Show keyboard while animating/typing; hide 1s after user stops.
    keyboardVisible = true
    if (hideKeyboardTimer) window.clearTimeout(hideKeyboardTimer)

    const unitPts = getUnitPoints(text)
    const { pts } = mapToCanvas(unitPts)

    const width = clamp(Number(elWidth.value), 1, 40)
    const color = elColor.value || '#ffffff'

    // Progressive draw along straight segments
    const dense = pts.map((p) => ({ x: p.x, y: p.y }))
    const totalLen = polylineLength(dense)

    // If nothing to animate, just render
    if (dense.length < 2 || totalLen < 2) {
      renderFrame()
      hideKeyboardTimer = window.setTimeout(() => {
        keyboardVisible = false
        renderFrame()
        canvasOverlay.classList.remove('active')
      }, 1000)
      return
    }

    const start = performance.now()
    // Duration scales with path length but capped for UX
    const duration = clamp(450 + totalLen * 1.2, 520, 1700)

    const bgValue = elBg.value
    const bg = bgColorFromSelect(bgValue)

    const step = (now) => {
      const t = clamp((now - start) / duration, 0, 1)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      const maxLen = totalLen * eased

      // Clear + optional bg fill
      setCanvasBg(bgValue)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (bg) {
        ctx.save()
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.restore()
      }
      if (keyboardVisible) drawKeyboardOverlay()

      // Draw partial signature only (no points/labels during animation)
      ctx.save()
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      drawPartialPolyline(dense, maxLen)
      ctx.restore()

      if (t < 1) {
        rafId = requestAnimationFrame(step)
      } else {
        // Final static render so it exactly matches the normal drawing (points/labels optional)
        renderFrame()
        hideKeyboardTimer = window.setTimeout(() => {
          keyboardVisible = false
          renderFrame()
          canvasOverlay.classList.remove('active')
        }, 1000)
      }
    }

    rafId = requestAnimationFrame(step)
  }

  function downloadPng() {
    // Export should always be "signature only" (no keyboard/points/labels),
    // even if they are visible on screen.
    const prevKeyboard = keyboardVisible
    const prevPoints = elPoints.checked
    const prevLabels = elLabels.checked

    keyboardVisible = false
    elPoints.checked = false
    elLabels.checked = false

    renderFrame({ signatureOnly: true })

    const a = document.createElement('a')
    const safeName = normalizeText(elText.value).slice(0, 32) || 'signature'
    a.download = `keyboard-signature-${safeName}.png`
    a.href = canvas.toDataURL('image/png')
    a.click()

    // Restore UI state + redraw
    keyboardVisible = prevKeyboard
    elPoints.checked = prevPoints
    elLabels.checked = prevLabels
    renderFrame()
  }

  // Live redraw on any change
  const liveEls = [elText, elColor, elWidth, elBg, elPoints, elLabels]
  for (const el of liveEls) {
    // On text input: animate drawing
    if (el === elText) {
      el.addEventListener('input', () => {
        const t = normalizeText(elText.value)
        // Avoid restarting animation if nothing effectively changed
        if (t === lastDrawnText) return
        lastDrawnText = t
        animateSignature()
      })
    } else {
      // On control changes, redraw (and also show keyboard briefly for explainability)
      el.addEventListener('input', () => {
        keyboardVisible = true
        renderFrame()
        if (hideKeyboardTimer) window.clearTimeout(hideKeyboardTimer)
        hideKeyboardTimer = window.setTimeout(() => {
          keyboardVisible = false
          renderFrame()
        }, 1000)
      })
      el.addEventListener('change', () => {
        keyboardVisible = true
        renderFrame()
        if (hideKeyboardTimer) window.clearTimeout(hideKeyboardTimer)
        hideKeyboardTimer = window.setTimeout(() => {
          keyboardVisible = false
          renderFrame()
        }, 1000)
      })
    }
  }

  btnDownload.addEventListener('click', downloadPng)

  function openEdit() {
    if (typeof editDialog.showModal === 'function') {
      editDialog.showModal()
    } else {
      editDialog.style.display = 'block'
      editDialog.setAttribute('open', 'open')
    }
    // Focus first control in dialog for quick editing
    setTimeout(() => elColor.focus(), 0)
  }

  btnEdit.addEventListener('click', openEdit)

  editForm.addEventListener('submit', (e) => {
    e.preventDefault()

    const submitter = e.submitter
    const isApply = submitter && submitter.id === 'btnApply'

    // Close dialog either way
    if (typeof editDialog.close === 'function') {
      editDialog.close()
    } else {
      editDialog.style.display = 'none'
      editDialog.removeAttribute('open')
    }

    // If Cancel/Close, do nothing (no changes applied visually)
    if (!isApply) return

    // Apply in one go (no restart animation): redraw immediately
    lastDrawnText = normalizeText(elText.value)
    keyboardVisible = true
    renderFrame()
    if (hideKeyboardTimer) window.clearTimeout(hideKeyboardTimer)
    hideKeyboardTimer = window.setTimeout(() => {
      keyboardVisible = false
      renderFrame()
    }, 1000)
  })

  btnHelp.addEventListener('click', () => {
    if (typeof helpDialog.showModal === 'function') {
      helpDialog.showModal()
    } else {
      helpDialog.style.display = 'block'
      helpDialog.setAttribute('open', 'open')
    }
  })

  // Update width value display
  elWidth.addEventListener('input', () => {
    widthValue.textContent = elWidth.value + 'px'
  })

  // Initialize width value display
  widthValue.textContent = elWidth.value + 'px'

  // Bootstrap
  setCanvasBg(elBg.value)
  keyboardVisible = true
  // Default: points/labels OFF (unchecked)
  elPoints.checked = false
  elLabels.checked = false
  renderFrame()
})()

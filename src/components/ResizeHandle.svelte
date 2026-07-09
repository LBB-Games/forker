<script>
  import { clampPaneSize } from '../lib/paneSizing.js';

  let {
    orientation = 'vertical',
    label = 'Resize pane',
    value = 0,
    min = 0,
    max = Number.POSITIVE_INFINITY,
    step = 16,
    direction = 1,
    getMax = null,
    onResize = () => {},
    onResizeEnd = () => {},
    onReset = null,
  } = $props();

  let dragging = $state(false);
  let dragStartPosition = 0;
  let dragStartValue = 0;
  let dragMax = Number.POSITIVE_INFINITY;

  let separatorValue = $derived(Math.round(value));
  let separatorMax = $derived(getClampedMax());
  let isVertical = $derived(orientation === 'vertical');

  function getClampedMax() {
    const nextMax = typeof getMax === 'function' ? getMax() : max;
    return Number.isFinite(Number(nextMax)) ? Number(nextMax) : Number.POSITIVE_INFINITY;
  }

  function clamp(valueToClamp, maxValue = getClampedMax()) {
    return clampPaneSize(valueToClamp, min, maxValue);
  }

  function pointerPosition(event) {
    return isVertical ? event.clientX : event.clientY;
  }

  function updatePointerResize(event) {
    if (!dragging) return;
    const delta = pointerPosition(event) - dragStartPosition;
    onResize(clamp(dragStartValue + delta * direction, dragMax));
  }

  function removePointerListeners() {
    window.removeEventListener('pointermove', updatePointerResize);
    window.removeEventListener('pointerup', stopPointerResize);
    window.removeEventListener('pointercancel', stopPointerResize);
  }

  function stopPointerResize() {
    if (!dragging) return;
    dragging = false;
    removePointerListeners();
    onResizeEnd();
  }

  function startPointerResize(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    dragging = true;
    dragStartPosition = pointerPosition(event);
    dragStartValue = value;
    dragMax = getClampedMax();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', updatePointerResize);
    window.addEventListener('pointerup', stopPointerResize);
    window.addEventListener('pointercancel', stopPointerResize);
  }

  function handleKeydown(event) {
    const keyDeltas = isVertical
      ? { ArrowLeft: -step, ArrowRight: step, Home: 'min', End: 'max' }
      : { ArrowUp: -step, ArrowDown: step, Home: 'min', End: 'max' };
    const keyDelta = keyDeltas[event.key];

    if (keyDelta === undefined) return;
    event.preventDefault();

    const nextMax = getClampedMax();
    if (keyDelta === 'min') {
      onResize(clamp(min, nextMax));
    } else if (keyDelta === 'max') {
      onResize(clamp(nextMax, nextMax));
    } else {
      onResize(clamp(value + keyDelta * direction, nextMax));
    }
    onResizeEnd();
  }

  function handleDoubleClick() {
    if (typeof onReset !== 'function') return;
    onReset();
    onResizeEnd();
  }

  $effect(() => {
    return () => {
      if (dragging) removePointerListeners();
    };
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="resize-handle {orientation}"
  class:dragging
  role="separator"
  tabindex="0"
  aria-label={label}
  aria-orientation={orientation}
  aria-valuemin={min}
  aria-valuemax={Number.isFinite(separatorMax) ? Math.round(separatorMax) : undefined}
  aria-valuenow={separatorValue}
  title="Drag to resize. Double-click to reset."
  onpointerdown={startPointerResize}
  onkeydown={handleKeydown}
  ondblclick={handleDoubleClick}
></div>

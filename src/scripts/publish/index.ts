// @ts-nocheck
import { disableSwupFromPublish, downloadBlob } from "./dom";
import { datetimeDigitIndexes, datetimeMask, datetimeToIso, datetimeValue, normalizeDatetimeValue } from "./datetime";
import { draftMarkdownFileName, draftZipFileName } from "./draftZip";
import { extensionForUploadedImage, thumbNameForFileName } from "./images";
import { clampGridSize, gridRatioLabel } from "./layouts";
import { yamlString } from "./markdown";
import { publishErrorMessage } from "./publishApi";
import { maxImages, randomId, tileCount } from "./state";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
	import { OverlayScrollbars } from "overlayscrollbars";
	import PhotoSwipe from "photoswipe";

	if (window.location.hostname === "strailico.me") {
		window.location.replace(`https://dashboard.strailico.me/publish/${window.location.search}${window.location.hash}`);
	}

	const imagePanel = document.querySelector("#image-panel");
	const metaEditor = document.querySelector("#meta-editor");
	const metaLocation = document.querySelector(".meta-location");
	const locationInput = document.querySelector("#location-input");
	const toggleLocationButton = document.querySelector("#toggle-location-button");
	const datetimeInput = document.querySelector("#datetime-input");
	const editorScrollShell = document.querySelector(".editor-scroll-shell");
	const editorTextarea = document.querySelector("#editor-pane textarea");
	const syntaxCodeFrame = document.querySelector('[data-native-code-frame="syntax"]');
	const datetimeCaret = document.querySelector(".datetime-caret");
	const setNowButton = document.querySelector("#set-now-button");
	const publishStatus = document.querySelector(".publish-status");
	const publishButton = document.querySelector("#publish-button");
	const downloadDraftButton = document.querySelector("#download-draft-button");
	const openDraftButton = document.querySelector("#open-draft-button");
	const imageFileInput = document.querySelector("#image-file-input");
	const draftFileInput = document.querySelector("#draft-file-input");
	const imageAddButton = document.querySelector("#image-add-button");
	const imageTrashButton = document.querySelector("#image-trash-button");
	const canvasFooterCenter = document.querySelector(".canvas-footer-center");
	const canvasSyntaxControl = document.querySelector("#canvas-syntax-control");
	const canvasSyntaxButton = document.querySelector("#canvas-syntax-button");
	const tileSwapToggleButton = document.querySelector("#tile-swap-toggle-button");
	const canvasSyntaxPanel = document.querySelector("#canvas-syntax-panel");
	const canvasNextActions = document.querySelector(".canvas-next-actions");
	const canvasNextButton = document.querySelector("#canvas-next-button");
	const syntaxBackButton = document.querySelector("#syntax-back-button");
	const canvasSyntaxModeButtons = Array.from(document.querySelectorAll("[data-canvas-syntax-mode]"));
	const gridSizeControl = document.querySelector("#grid-size-control");
	const gridWidthValue = document.querySelector("#grid-width-value");
	const gridHeightValue = document.querySelector("#grid-height-value");
	const singleWidthDisplay = document.querySelector("#single-width-display");
	const singleWidthValue = document.querySelector("#single-width-value");
	const singleWidthInputShell = document.querySelector("#single-width-input-shell");
	const singleWidthInput = document.querySelector("#single-width-input");
	const gridSizeApplyButton = document.querySelector("#grid-size-apply-button");
	const gridRatioControl = document.querySelector("#grid-ratio-control");
	const gridRatioWidthValue = document.querySelector("#grid-ratio-width-value");
	const gridRatioHeightValue = document.querySelector("#grid-ratio-height-value");
	const gridRatioRotateButton = document.querySelector("#grid-ratio-rotate-button");
	const mosaicRatioControl = document.querySelector("#mosaic-ratio-control");
	const mosaicRatioWidthValue = document.querySelector("#mosaic-ratio-width-value");
	const mosaicRatioHeightValue = document.querySelector("#mosaic-ratio-height-value");
	const mosaicRatioSwapButton = document.querySelector("#mosaic-ratio-swap-button");
	const mosaicRowActions = document.querySelector("#mosaic-row-actions");
	const mosaicAddRowButton = document.querySelector("#mosaic-add-row-button");
	const mosaicAddTileButton = document.querySelector("#mosaic-add-tile-button");
	const gridTileContainer = document.querySelector("#canvas-editor .image-grid");
	let gridTiles = Array.from(document.querySelectorAll("#canvas-editor .image-tile"));
	const astroScopeAttributes = Array.from(gridTiles[0]?.attributes ?? [])
		.filter((attribute) => attribute.name.startsWith("data-astro"))
		.map((attribute) => [attribute.name, attribute.value]);
	const emptyTileIconMarkup =
		gridTiles.find((tile) => tile.classList.contains("empty"))?.querySelector("svg")?.outerHTML ??
		`<svg aria-hidden="true" viewBox="0 0 24 24"><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m0 16H5V5h14zm-5.04-6.71l-2.75 3.54l-1.96-2.36L6.5 17h11zM16 8v2h2v2h2v-2h2V8h-2V6h-2v2z"/></svg>`;
	const modeButtons = Array.from(document.querySelectorAll("[data-editor-mode]"));
	const imageSegmentedControl = document.querySelector("[aria-label='Image editor mode']");
	const panes = {
		canvas: document.querySelector("#canvas-editor"),
		syntax: document.querySelector("#syntax-editor"),
	};

	let gridRows = 2;
	let gridColumns = 2;
	let pendingGridRows = gridRows;
	let pendingGridColumns = gridColumns;
	let gridCellRatioWidth = 1;
	let gridCellRatioHeight = 1;
	let pendingGridCellRatioWidth = gridCellRatioWidth;
	let pendingGridCellRatioHeight = gridCellRatioHeight;
	let gridRatioPortraitMode = false;
	let mosaicRows = [];
	let mosaicRowRatios = Array.from({ length: 4 }, () => ({ width: 1, height: 1 }));
	let activeMosaicRowIndex = 0;
	let pendingMosaicRowRatioWidth = 1;
	let pendingMosaicRowRatioHeight = 1;
	const gridRatioPresets = [
		[1, 1],
		[16, 9],
		[16, 10],
		[5, 4],
		[7, 5],
		[4, 3],
		[5, 3],
		[3, 2],
	];
	let singleWidth = 75;
	let pendingSingleWidth = singleWidth;
	let suppressGridApplyReveal = false;
	let activeGridDrag = null;
	let singleWidthEditing = false;
	const gridCapacity = () => (isSingleCanvasMode() ? 1 : gridRows * gridColumns);
	const publishEndpoint = import.meta.env.PUBLIC_PUBLISH_API_ENDPOINT || "/api/publish";
	const datetimeMeasureCanvas = document.createElement("canvas");
	const datetimeMeasureContext = datetimeMeasureCanvas.getContext("2d");
	const originalTileFiles = new WeakMap();

	if (datetimeInput) {
		datetimeInput.value = datetimeValue();
	}

	let eventRandomSuffix = randomId();
	let eventId = currentEventId();
	let nextImageNumber = 1;
	let selectedTile = null;
	let tileSwapEnabled = false;
	let pendingUploadTarget = null;
	let imageMode = "off";
	let canvasSyntaxMode = "grid";
	let draftState = "ready";
	let publishSucceeded = false;
	let publishTimer = 0;
	let imageTrashTimer = 0;
	let editorScrollbar = null;
	const metaTransitionMs = 260;
	const imagesById = new Map();
	const imageOrder = [];
	const gridSlots = Array(tileCount).fill(null);	function pad(value) {
		return String(value).padStart(2, "0");
	}	function currentDateCode() {
		const digits = datetimeInput?.value.replace(/\D/g, "") ?? "";
		return `${digits.slice(0, 2)}${digits.slice(2, 4)}${digits.slice(4, 8)}`;
	}

	function currentEventId() {
		const digits = datetimeInput?.value.replace(/\D/g, "") ?? "";
		const prefix = `${digits.slice(0, 2)}${digits.slice(2, 4)}${digits.slice(6, 8)}${digits.slice(8, 10)}${digits.slice(10, 12)}`;
		return `${prefix || "0000000000"}-${eventRandomSuffix}`;
	}	function syncEventIdToDatetime() {
		const nextEventId = currentEventId();
		if (nextEventId === eventId) {
			return;
		}
		const updates = imageOrder
			.map((oldImageId, index) => {
				const image = imagesById.get(oldImageId);
				if (!image) {
					return null;
				}
				const number = Number(image.id.match(/-(\d+)$/)?.[1]) || index + 1;
				const extension = image.outputExtension || image.fileName.split(".").pop()?.toLowerCase() || "png";
				const nextImageId = `${nextEventId}-${number}`;
				return { oldImageId, nextImageId, image, extension };
			})
			.filter(Boolean);
		eventId = nextEventId;
		for (const { oldImageId, nextImageId, image, extension } of updates) {
			imagesById.delete(oldImageId);
			image.id = nextImageId;
			image.fileName = `${nextImageId}.${extension}`;
			image.thumbName = thumbNameForFileName(image.fileName);
			imagesById.set(nextImageId, image);
			for (let index = 0; index < imageOrder.length; index += 1) {
				if (imageOrder[index] === oldImageId) {
					imageOrder[index] = nextImageId;
				}
			}
			for (let index = 0; index < gridSlots.length; index += 1) {
				if (gridSlots[index] === oldImageId) {
					gridSlots[index] = nextImageId;
				}
			}
			for (const row of mosaicRows) {
				row.imageIds = (row.imageIds ?? []).map((imageId) => (imageId === oldImageId ? nextImageId : imageId));
			}
		}
	}	function isoToDatetimeValue(value) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			return normalizeDatetimeValue("");
		}
		return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
	}

	function setDraftState(state) {
		draftState = state;
		publishStatus?.setAttribute("data-state", state);
		publishStatus?.setAttribute(
			"aria-label",
			state === "processing"
				? "Preparing draft source"
				: state === "publishing"
					? "Publishing"
					: state === "published"
						? "Published"
						: "Draft source ready",
		);
		publishStatus?.setAttribute("aria-disabled", "true");
		publishStatus?.setAttribute("disabled", "");
	}

	function markDirty() {
		publishSucceeded = false;
		if (draftState === "published") {
			setDraftState("ready");
		}
		fitEditorTextarea();
		updateOutput();
	}

	function resetEditorOnEntry() {
		if (editorTextarea) {
			editorTextarea.value = "";
		}
		publishSucceeded = false;
		setDraftState("ready");
		fitEditorTextarea();
		updateOutput();
	}	function fitEditorTextarea() {
		if (!editorTextarea) {
			return;
		}
		editorTextarea.style.height = "auto";
		editorTextarea.style.height = `${editorTextarea.scrollHeight}px`;
		editorScrollbar?.update();
	}

	function initEditorScrollbar() {
		if (!editorScrollShell || editorScrollbar) {
			return;
		}
		editorScrollbar = OverlayScrollbars(editorScrollShell, {
			scrollbars: {
				theme: "scrollbar-base scrollbar-auto",
				autoHide: "leave",
				autoHideDelay: 500,
				autoHideSuspend: false,
			},
		});
	}

	function withViewportAnchor(anchor, callback) {
		const top = anchor?.getBoundingClientRect?.().top;
		callback();
		if (top === undefined) {
			return;
		}
		window.requestAnimationFrame(() => {
			if (!anchor.isConnected) {
				return;
			}
			window.scrollBy(0, anchor.getBoundingClientRect().top - top);
		});
	}

	function updateDatetimeCaret() {
		if (!datetimeInput || !datetimeCaret || !datetimeMeasureContext) {
			return;
		}
		const dateControl = datetimeInput.closest(".date-control");
		const inputStyles = window.getComputedStyle(datetimeInput);
		const controlStyles = dateControl ? window.getComputedStyle(dateControl) : inputStyles;
		const inputLeft = datetimeInput.offsetLeft + Number.parseFloat(inputStyles.paddingLeft);
		const textBeforeCaret = datetimeInput.value.slice(0, datetimeInput.selectionStart ?? 0);
		const activeCharacter = datetimeInput.value[datetimeInput.selectionStart ?? 0] || "0";
		datetimeMeasureContext.font = inputStyles.font;
		const caretLeft = inputLeft + datetimeMeasureContext.measureText(textBeforeCaret).width;
		const caretWidth = datetimeMeasureContext.measureText(activeCharacter).width;
		datetimeCaret.style.left = `${caretLeft}px`;
		datetimeCaret.style.width = `${Math.max(caretWidth, 7)}px`;
		datetimeCaret.style.top = `calc(50% + ${
			(Number.parseFloat(controlStyles.borderTopWidth) || 0) -
			(Number.parseFloat(controlStyles.borderBottomWidth) || 0)
		}px)`;
		datetimeCaret.classList.toggle(
			"visible",
			document.activeElement === datetimeInput,
		);
	}

	function getClosestDatetimeDigitIndex(index, direction = 1) {
		const sortedIndexes = direction < 0 ? [...datetimeDigitIndexes].reverse() : datetimeDigitIndexes;
		return (
			sortedIndexes.find((digitIndex) =>
				direction < 0 ? digitIndex <= index : digitIndex >= index,
			) ?? sortedIndexes[sortedIndexes.length - 1]
		);
	}	function setDatetimeDigit(input, index, digit) {
		const nextIndex = getClosestDatetimeDigitIndex(index);
		const chars = input.value.padEnd(datetimeMask.length, "0").split("");
		chars[nextIndex] = digit;
		input.value = normalizeDatetimeValue(chars.join(""));
		const followingIndex = datetimeDigitIndexes.find((digitIndex) => digitIndex > nextIndex) ?? nextIndex;
		input.setSelectionRange(followingIndex, followingIndex);
		syncEventIdToDatetime();
		renderAllImages();
		markDirty();
		updateDatetimeCaret();
	}

	function clearDatetimeDigit(input, direction) {
		const cursor = input.selectionStart ?? 0;
		const selectedIndex =
			input.selectionStart !== input.selectionEnd
				? getClosestDatetimeDigitIndex(cursor)
				: direction === "backward"
					? getClosestDatetimeDigitIndex(cursor - 1, -1)
					: getClosestDatetimeDigitIndex(cursor);
		const chars = input.value.padEnd(datetimeMask.length, "0").split("");
		chars[selectedIndex] = "0";
		input.value = normalizeDatetimeValue(chars.join(""));
		input.setSelectionRange(selectedIndex, selectedIndex);
		syncEventIdToDatetime();
		renderAllImages();
		markDirty();
		updateDatetimeCaret();
	}

	function makeImageNames() {
		const number = nextImageNumber;
		nextImageNumber += 1;
		const id = `${eventId}-${number}`;
		return {
			id,
			fileName: `${id}.png`,
			thumbName: `${id}_thumb.webp`,
		};
	}	function mimeTypeForExtension(extension) {
		return extension === "jpg" || extension === "jpeg" ? "image/jpeg" : "image/png";
	}	function tileHasImage(tile) {
		return tile.classList.contains("filled");
	}

	function clearTileSelection() {
		for (const tile of getImageTiles()) {
			tile.classList.remove("selected");
		}
		selectedTile = null;
		if (imageMode === "canvas" && canvasSyntaxMode === "mosaic") {
			syncMosaicSelectionState();
		}
	}

	function pointerIsOverCanvasTile(event) {
		return gridTiles.some((tile) => {
			const rect = tile.getBoundingClientRect();
			return (
				event.clientX >= rect.left &&
				event.clientX <= rect.right &&
				event.clientY >= rect.top &&
				event.clientY <= rect.bottom
			);
		});
	}

	function suppressCanvasTileHoverUntilPointerLeaves(event) {
		clearTileSelection();
		gridTileContainer?.classList.add("tile-hover-suppressed");
		if (!event || !pointerIsOverCanvasTile(event)) {
			gridTileContainer?.classList.remove("tile-hover-suppressed");
			return;
		}
		const restoreTileHover = (moveEvent) => {
			if (pointerIsOverCanvasTile(moveEvent)) {
				return;
			}
			gridTileContainer?.classList.remove("tile-hover-suppressed");
			document.removeEventListener("pointermove", restoreTileHover);
			document.removeEventListener("pointerleave", restoreTileHover);
		};
		document.addEventListener("pointermove", restoreTileHover);
		document.addEventListener("pointerleave", restoreTileHover);
	}

	function selectTile(tile) {
		clearTileSelection();
		tile.classList.add("selected");
		selectedTile = tile;
		if (imageMode === "canvas" && canvasSyntaxMode === "mosaic") {
			activeMosaicRowIndex = mosaicRowIndexForTile(tile);
			syncMosaicSelectionState();
			updateGridSizeControl();
		}
	}

	function getImageTiles() {
		return Array.from(document.querySelectorAll(".image-tile"));
	}

	function uniqueImageIds(ids) {
		const seen = new Set();
		return ids.filter((id) => {
			if (!id || seen.has(id)) {
				return false;
			}
			seen.add(id);
			return true;
		});
	}

	function releaseImage(imageId) {
		const image = imagesById.get(imageId);
		if (image?.src?.startsWith("blob:")) {
			URL.revokeObjectURL(image.src);
		}
		imagesById.delete(imageId);
	}

	function removeImageFromPool(imageId) {
		if (!imageId) {
			return;
		}
		const orderIndex = imageOrder.indexOf(imageId);
		if (orderIndex !== -1) {
			imageOrder.splice(orderIndex, 1);
		}
		for (let index = 0; index < gridSlots.length; index += 1) {
			if (gridSlots[index] === imageId) {
				gridSlots[index] = null;
			}
		}
		mosaicRows = mosaicRows
			.map((row) => ({
				imageIds: (row.imageIds ?? []).filter((rowImageId) => rowImageId !== imageId),
			}))
			.filter((row) => row.imageIds.length > 0);
		releaseImage(imageId);
	}

	function clearTile(tile) {
		removeImageFromPool(imageIdForTile(tile));
		renderAllImages();
		clearTileSelection();
		markDirty();
	}

	function clearAllTiles() {
		const fileNames = Array.from(imagesById.values(), (image) => image.fileName);
		for (const image of imagesById.values()) {
			if (image?.src?.startsWith("blob:")) {
				URL.revokeObjectURL(image.src);
			}
		}
		removeImageSyntaxLines(fileNames);
		imagesById.clear();
		imageOrder.splice(0, imageOrder.length);
		gridSlots.fill(null);
		mosaicRows = [];
		renderAllImages();
		clearTileSelection();
		markDirty();
	}

	function tileIndex(tile) {
		return Number(tile.dataset.slot ?? tile.dataset.index ?? 0);
	}

	function tileArea(tile) {
		if (tile.dataset.area === "pool-add") {
			return "pool-add";
		}
		return tile.dataset.area === "pool" ? "pool" : "grid";
	}

	function imageIdForTile(tile) {
		const index = tileIndex(tile);
		if (tileArea(tile) === "pool-add") {
			return null;
		}
		if (imageMode === "canvas" && canvasSyntaxMode === "mosaic" && tile.dataset.imageId) {
			return tile.dataset.imageId;
		}
		return tileArea(tile) === "pool" ? imageOrder[index] ?? null : gridSlots[index] ?? null;
	}

	function imageRecordFromTile(tile, fallbackIndex) {
		const img = tile.querySelector("img");
		if (!img) {
			return null;
		}
		const fileName = img.src.split("/").pop() || `${eventId}-${fallbackIndex + 1}.webp`;
		const id = fileName.replace(/_thumb\.webp$|\.webp$/g, "");
		const fullName = fileName.replace(/_thumb\.webp$/, ".webp");
		nextImageNumber = Math.max(nextImageNumber, (Number(id.match(/-(\d+)$/)?.[1]) || 0) + 1);
		return {
			id,
			fileName: fullName,
			thumbName: fullName.replace(/\.webp$/, "_thumb.webp"),
			src: img.currentSrc || img.src,
			width: 0,
			height: 0,
			thumbWidth: 0,
			thumbHeight: 0,
			source: null,
			full: null,
			thumb: null,
		};
	}

	function applyAstroScope(element) {
		if (!element || astroScopeAttributes.length === 0) {
			return;
		}
		for (const node of [element, ...element.querySelectorAll("*")]) {
			for (const [name, value] of astroScopeAttributes) {
				node.setAttribute(name, value);
			}
		}
	}

	async function measureImageSource(source) {
		const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
		const dimensions = { width: bitmap.width, height: bitmap.height };
		bitmap.close();
		return dimensions;
	}

	function singleCanvasFrameAspectRatio() {
		if (imageMode === "canvas" && canvasSyntaxMode === "grid") {
			return `${gridColumns * gridCellRatioWidth} / ${gridRows * gridCellRatioHeight}`;
		}
		if (imageMode === "canvas" && canvasSyntaxMode === "mosaic") {
			return String(canvasFrameLayoutRatio());
		}
		if (!isSingleCanvasMode()) {
			return `${gridColumns} / ${gridRows}`;
		}
		const image = imagesById.get(gridSlots[0] ?? "");
		if (!image?.width || !image?.height) {
			return "4 / 3";
		}
		return `${image.width} / ${image.height}`;
	}

	function singleCanvasFrameRatioNumber() {
		const image = imagesById.get(gridSlots[0] ?? "");
		if (!image?.width || !image?.height) {
			return 4 / 3;
		}
		return Math.max(0.1, image.width / image.height);
	}

	function canvasFrameLayoutRatio() {
		if (imageMode === "canvas" && canvasSyntaxMode === "grid") {
			return Math.max(0.1, (gridColumns * gridCellRatioWidth) / (gridRows * gridCellRatioHeight));
		}
		if (imageMode === "canvas" && canvasSyntaxMode === "mosaic") {
			syncMosaicRowsFromImagePool();
			const rowHeightUnits = mosaicRows.reduce((total, row, rowIndex) => {
				const imageCount = Math.max(1, (row.imageIds ?? []).filter((imageId) => imagesById.has(imageId)).length);
				const ratio = mosaicRatioForRow(rowIndex);
				return total + ratio.height / Math.max(0.1, imageCount * ratio.width);
			}, 0);
			return Math.max(0.1, 1 / Math.max(0.1, rowHeightUnits));
		}
		return 1;
	}

	function syncCanvasFrame() {
		if (!gridTileContainer) {
			return;
		}
		if (isSingleCanvasMode()) {
			gridTileContainer.style.width = "100%";
			gridTileContainer.style.aspectRatio = "";
			gridTileContainer.style.setProperty("--single-frame-width", `${pendingSingleWidth}%`);
			gridTileContainer.style.setProperty("--single-frame-ratio", singleCanvasFrameAspectRatio());
			gridTileContainer.style.setProperty("--single-frame-ratio-number", String(singleCanvasFrameRatioNumber()));
			return;
		}
		const ratio = canvasFrameLayoutRatio();
		if (imageMode === "canvas" && canvasSyntaxMode === "grid") {
			gridTileContainer.style.width = `min(100%, calc(${ratio} * var(--canvas-frame-max-height)))`;
			gridTileContainer.style.aspectRatio = String(ratio);
			return;
		}
		gridTileContainer.style.width = "100%";
		gridTileContainer.style.aspectRatio = "";
	}

	function setTileImage(tile, imageId, number = tileIndex(tile) + 1) {
		const image = imageId ? imagesById.get(imageId) : null;
		if (image) {
			tile.innerHTML = `<img src="${image.src}" alt="" loading="lazy" decoding="async" /><span>${number}</span>`;
			tile.classList.add("filled");
			tile.classList.remove("empty");
		} else {
			tile.innerHTML = `${emptyTileIconMarkup}<span>${number}</span>`;
			tile.classList.remove("filled");
			tile.classList.add("empty");
		}
		applyAstroScope(tile);
	}

	function createGridTile(index) {
		const tile = document.createElement("button");
		tile.className = "image-tile empty";
		tile.type = "button";
		tile.dataset.area = "grid";
		tile.dataset.slot = String(index);
		tile.setAttribute("aria-label", `Grid image ${index + 1}`);
		setTileImage(tile, gridSlots[index] ?? null, index + 1);
		return tile;
	}

	function ensureGridTiles() {
		if (!gridTileContainer) {
			return;
		}
		const capacity = gridCapacity();
		const singleMode = isSingleCanvasMode();
		const mosaicMode = imageMode === "canvas" && canvasSyntaxMode === "mosaic";
		gridTileContainer.classList.toggle("single-mode", singleMode);
		gridTileContainer.classList.toggle("grid-mode", imageMode === "canvas" && canvasSyntaxMode === "grid");
		gridTileContainer.classList.toggle("mosaic-mode", mosaicMode);
		gridTileContainer.style.gridTemplateColumns = singleMode ? "minmax(0, 1fr)" : `repeat(${gridColumns}, minmax(0, 1fr))`;
		gridTileContainer.style.gridTemplateRows =
			imageMode === "canvas" && canvasSyntaxMode === "grid"
				? `repeat(${gridRows}, minmax(0, 1fr))`
				: "";
		syncCanvasFrame();
		gridTileContainer.style.setProperty("--grid-cell-ratio", `${gridCellRatioWidth} / ${gridCellRatioHeight}`);
		if (mosaicMode) {
			return;
		}
		const hasDirectTiles =
			gridTiles.length === capacity &&
			Array.from(gridTileContainer.children).every((child) => child.classList.contains("image-tile"));
		if (hasDirectTiles) {
			return;
		}
		gridTileContainer.innerHTML = "";
		gridTiles = [];
		for (let index = 0; index < capacity; index += 1) {
			const tile = createGridTile(index);
			gridTileContainer.append(tile);
			gridTiles.push(tile);
		}
	}

	function renderTiles() {
		ensureGridTiles();
		const selectedSlotIndex = selectedTile && tileArea(selectedTile) === "grid" ? tileIndex(selectedTile) : -1;
		selectedTile = null;
		if (imageMode === "canvas" && canvasSyntaxMode === "mosaic") {
			renderMosaicTiles(selectedSlotIndex);
			return;
		}
		for (const tile of gridTiles) {
			tile.dataset.area = "grid";
			tile.classList.toggle("single-mode", isSingleCanvasMode());
			setTileImage(tile, gridSlots[tileIndex(tile)]);
			if (tileIndex(tile) === selectedSlotIndex) {
				tile.classList.add("selected");
				selectedTile = tile;
			}
		}
		gridTileContainer?.classList.toggle("single-filled", isSingleCanvasMode() && Boolean(gridSlots[0]));
	}

	function renderMosaicTiles(selectedSlotIndex = -1) {
		if (!gridTileContainer) {
			return;
		}
		syncMosaicRowsFromImagePool();
		syncMosaicSelectionState();
		gridTileContainer.innerHTML = "";
		gridTiles = [];
		let tileNumber = 1;
		for (let rowIndex = 0; rowIndex < mosaicRows.length; rowIndex += 1) {
			const row = mosaicRows[rowIndex];
			const imageIds = (row.imageIds ?? []).filter((imageId) => imagesById.has(imageId));
			if (imageIds.length === 0) {
				continue;
			}
			const rowElement = document.createElement("div");
			rowElement.className = "mosaic-canvas-row";
			applyAstroScope(rowElement);
			const ratio = mosaicRatioForRow(rowIndex);
			rowElement.style.setProperty("--mosaic-row-ratio", `${ratio.width} / ${ratio.height}`);
			rowElement.style.setProperty("--mosaic-row-columns", String(Math.max(1, imageIds.length)));
			for (const imageId of imageIds) {
				const tile = createGridTile(tileNumber - 1);
				tile.dataset.rowIndex = String(rowIndex);
				tile.dataset.imageId = imageId;
				setTileImage(tile, imageId, tileNumber);
				if (tileIndex(tile) === selectedSlotIndex || selectedTile?.dataset.imageId === imageId) {
					tile.classList.add("selected");
					selectedTile = tile;
				}
				rowElement.append(tile);
				gridTiles.push(tile);
				tileNumber += 1;
			}
			gridTileContainer.append(rowElement);
		}
		gridTileContainer.classList.remove("single-filled");
	}

	function renderImageStrip() {
		const strip = document.querySelector("#syntax-editor .image-strip");
		if (!strip) {
			return;
		}
		strip.innerHTML = "";
		const displayCount = Math.min(
			maxImages,
			Math.max(gridCapacity(), imageOrder.length + (imageOrder.length < maxImages ? 1 : 0)),
		);
		for (let index = 0; index < displayCount; index += 1) {
			const tile = document.createElement("button");
			const imageId = imageOrder[index] ?? null;
			tile.className = `image-tile${imageId ? "" : " empty image-pool-add-tile"}`;
			tile.type = "button";
			tile.dataset.area = imageId ? "pool" : "pool-add";
			tile.dataset.index = String(index);
			tile.dataset.slot = String(index);
			tile.disabled = !imageId && imageOrder.length >= maxImages;
			tile.setAttribute(
				"aria-label",
				imageId ? `Image ${index + 1}` : imageOrder.length >= maxImages ? "Image pool is full" : "Add image",
			);
			setTileImage(tile, imageId, index + 1);
			strip.append(tile);
		}
	}

	function renderAllImages() {
		renderTiles();
		renderImageStrip();
		updateImageAddButton();
		updateImageModeAvailability();
		updateGridSizeControl();
		syncSyntaxView();
	}

	function updateImageModeAvailability() {
		const hasImages = imageOrder.some((imageId) => imagesById.has(imageId));
		for (const button of modeButtons) {
			button.disabled = !hasImages;
			button.setAttribute("aria-disabled", hasImages ? "false" : "true");
		}
	}

	function updateImageAddButton() {
		const isFull = imageOrder.length >= maxImages;
		imageAddButton?.toggleAttribute("disabled", isFull);
		for (const addTile of document.querySelectorAll(".image-pool-add-tile")) {
			addTile.toggleAttribute("disabled", isFull);
		}
	}	function parseGridRatio(value, fallbackWidth = 1, fallbackHeight = 1) {
		const match = `${value ?? ""}`.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
		if (!match) {
			return {
				width: clampGridSize(fallbackWidth),
				height: clampGridSize(fallbackHeight),
			};
		}
		return {
			width: clampGridSize(Number(match[1]) || fallbackWidth),
			height: clampGridSize(Number(match[2]) || fallbackHeight),
		};
	}	function orientGridRatio(width, height) {
		if (width === height) {
			return [width, height];
		}
		return gridRatioPortraitMode ? [height, width] : [width, height];
	}

	function gridRatioPresetIndex(width, height) {
		return Math.max(
			0,
			gridRatioPresets.findIndex(
				([presetWidth, presetHeight]) =>
					(presetWidth === width && presetHeight === height) || (presetWidth === height && presetHeight === width),
			),
		);
	}

	function ensureMosaicRowRatiosLength() {
		const rowCount = Math.max(1, mosaicRows.length || gridRows);
		while (mosaicRowRatios.length < rowCount) {
			mosaicRowRatios.push({ width: 1, height: 1 });
		}
		if (mosaicRowRatios.length > rowCount) {
			mosaicRowRatios = mosaicRowRatios.slice(0, rowCount);
		}
	}

	function mosaicRatioForRow(rowIndex) {
		ensureMosaicRowRatiosLength();
		return mosaicRowRatios[rowIndex] ?? { width: 1, height: 1 };
	}

	function defaultMosaicRowsForImageIds(imageIds) {
		const rows = [];
		let index = 0;
		let rowSize = 1;
		while (index < imageIds.length) {
			const size = Math.min(rowSize, 3, imageIds.length - index);
			rows.push({ imageIds: imageIds.slice(index, index + size) });
			index += size;
			rowSize += 1;
		}
		return rows;
	}

	function flattenedMosaicImageIds() {
		return uniqueImageIds(mosaicRows.flatMap((row) => row.imageIds ?? []));
	}

	function syncMosaicRowsFromImagePool({ rebuild = false } = {}) {
		const validIds = new Set(imageOrder);
		const existingRows = mosaicRows
			.map((row) => ({
				imageIds: uniqueImageIds(row.imageIds ?? []).filter((imageId) => validIds.has(imageId)),
			}))
			.filter((row) => row.imageIds.length > 0);
		const existingIds = new Set(existingRows.flatMap((row) => row.imageIds));
		const missingIds = imageOrder.filter((imageId) => !existingIds.has(imageId));
		if (rebuild || existingRows.length === 0) {
			mosaicRows = defaultMosaicRowsForImageIds(imageOrder);
		} else {
			mosaicRows = existingRows;
			for (const row of defaultMosaicRowsForImageIds(missingIds)) {
				mosaicRows.push(row);
			}
		}
		if (mosaicRows.length === 0) {
			mosaicRows = [{ imageIds: [] }];
		}
		ensureMosaicRowRatiosLength();
		activeMosaicRowIndex = Math.min(mosaicRows.length - 1, Math.max(0, activeMosaicRowIndex));
	}

	function firstPopulatedMosaicRowIndex() {
		syncMosaicRowsFromImagePool();
		for (let rowIndex = 0; rowIndex < mosaicRows.length; rowIndex += 1) {
			if ((mosaicRows[rowIndex]?.imageIds ?? []).some((imageId) => imagesById.has(imageId))) {
				return rowIndex;
			}
		}
		return 0;
	}

	function mosaicRowIndexForTile(tile) {
		return Math.min(Math.max(0, mosaicRows.length - 1), Math.max(0, Number(tile.dataset.rowIndex ?? 0)));
	}

	function hasLaterMosaicImage(rowIndex) {
		return mosaicRows.slice(rowIndex + 1).some((row) => (row.imageIds ?? []).some((imageId) => imagesById.has(imageId)));
	}

	function takeFirstLaterMosaicImage(rowIndex) {
		for (let nextRowIndex = rowIndex + 1; nextRowIndex < mosaicRows.length; nextRowIndex += 1) {
			const imageIds = mosaicRows[nextRowIndex]?.imageIds ?? [];
			const imageIndex = imageIds.findIndex((imageId) => imagesById.has(imageId));
			if (imageIndex === -1) {
				continue;
			}
			const [imageId] = imageIds.splice(imageIndex, 1);
			return { imageId, rowIndex: nextRowIndex };
		}
		return null;
	}

	function pruneEmptyMosaicRows() {
		const nextRows = [];
		const nextRatios = [];
		for (let rowIndex = 0; rowIndex < mosaicRows.length; rowIndex += 1) {
			const imageIds = (mosaicRows[rowIndex]?.imageIds ?? []).filter((imageId) => imagesById.has(imageId));
			if (imageIds.length === 0) {
				continue;
			}
			nextRows.push({ imageIds });
			nextRatios.push(mosaicRatioForRow(rowIndex));
		}
		mosaicRows = nextRows.length > 0 ? nextRows : [{ imageIds: [] }];
		mosaicRowRatios = nextRatios.length > 0 ? nextRatios : [{ width: 1, height: 1 }];
		activeMosaicRowIndex = Math.min(mosaicRows.length - 1, Math.max(0, activeMosaicRowIndex));
		ensureMosaicRowRatiosLength();
	}

	function syncMosaicSelectionState() {
		if (imageMode !== "canvas" || canvasSyntaxMode !== "mosaic") {
			return;
		}
		syncMosaicRowsFromImagePool();
		if (selectedTile && tileArea(selectedTile) === "grid") {
			activeMosaicRowIndex = mosaicRowIndexForTile(selectedTile);
		} else {
			activeMosaicRowIndex = firstPopulatedMosaicRowIndex();
		}
		const ratio = mosaicRatioForRow(activeMosaicRowIndex);
		pendingMosaicRowRatioWidth = ratio.width;
		pendingMosaicRowRatioHeight = ratio.height;
	}

	function canvasSlotRows({ includeEmptyRows = false } = {}) {
		const rows = [];
		for (let rowIndex = 0; rowIndex < gridRows; rowIndex += 1) {
			const start = rowIndex * gridColumns;
			const slots = [];
			for (let columnIndex = 0; columnIndex < gridColumns; columnIndex += 1) {
				const slotIndex = start + columnIndex;
				slots.push({
					slotIndex,
					imageId: gridSlots[slotIndex] ?? null,
				});
			}
			const filled = slots.filter((slot) => slot.imageId);
			if (includeEmptyRows || filled.length > 0) {
				rows.push({
					rowIndex,
					slots,
					filledImageIds: filled.map((slot) => slot.imageId),
				});
			}
		}
		return rows;
	}

	function clampSingleWidth(value) {
		return Math.min(100, Math.max(1, value));
	}

	function isSingleCanvasMode() {
		return imageMode === "canvas" && canvasSyntaxMode === "single";
	}

	function selectCanvasSyntaxModeForImageCount() {
		const imageCount = imageOrder.filter((imageId) => imagesById.has(imageId)).length;
		canvasSyntaxMode = imageCount <= 1 ? "single" : "mosaic";
		singleWidthEditing = false;
		pendingSingleWidth = singleWidth;
		pendingGridCellRatioWidth = gridCellRatioWidth;
		pendingGridCellRatioHeight = gridCellRatioHeight;
		if (canvasSyntaxMode === "mosaic") {
			syncMosaicRowsFromImagePool();
		}
		syncMosaicSelectionState();
	}

	function canvasFilledImageIds() {
		return gridSlots.slice(0, gridCapacity()).filter(Boolean);
	}

	function openImageGallery(imageId) {
		const imageIds = imageOrder.filter((currentImageId) => imagesById.has(currentImageId));
		const index = imageIds.indexOf(imageId);
		if (index === -1) {
			return;
		}
		const dataSource = imageIds
			.map((currentImageId) => imagesById.get(currentImageId))
			.filter(Boolean)
			.map((image) => ({
				src: image.src,
				msrc: image.src,
				width: image.width || 1600,
				height: image.height || 1200,
				alt: image.fileName,
			}));
		if (dataSource.length === 0) {
			return;
		}
		new PhotoSwipe({
			dataSource,
			index,
			mainClass: "pswp-vivia",
			bgOpacity: 0.92,
			showHideAnimationType: "fade",
			wheelToZoom: true,
		}).init();
	}

	function canvasImageRows() {
		return canvasSlotRows().map((row) => row.filledImageIds);
	}

	function hideCanvasSyntaxPanel() {
		canvasSyntaxPanel?.classList.add("float-panel-closed");
		canvasSyntaxButton?.setAttribute("aria-expanded", "false");
	}

	function showCanvasSyntaxPanel() {
		if (imageMode !== "canvas") {
			return;
		}
		canvasSyntaxPanel?.removeAttribute("hidden");
		canvasSyntaxPanel?.classList.remove("float-panel-closed");
		canvasSyntaxButton?.setAttribute("aria-expanded", "true");
	}

	function finishSingleWidthEditing({ commit = true } = {}) {
		if (!singleWidthInput) {
			return;
		}
		if (commit) {
			const nextValue = clampSingleWidth(Number.parseInt(singleWidthInput.value, 10) || pendingSingleWidth);
			pendingSingleWidth = nextValue;
			singleWidthInput.value = String(nextValue);
		} else {
			singleWidthInput.value = String(pendingSingleWidth);
		}
		singleWidthEditing = false;
		updateGridSizeControl();
		if (commit) {
			markDirty();
		}
	}

	function beginSingleWidthEditing() {
		if (!isSingleCanvasMode() || !singleWidthInput) {
			return;
		}
		singleWidthEditing = true;
		updateGridSizeControl();
		window.requestAnimationFrame(() => {
			singleWidthInput.focus();
			singleWidthInput.select();
		});
	}

	function renderNativeCodeFrame(frame, value) {
		const code = frame?.querySelector("code");
		const pre = frame?.querySelector("pre");
		if (!code) {
			return;
		}
		const lines = `${value ?? ""}`.split(/\r?\n/);
		code.replaceChildren(
			...lines.map((line, index) => {
				const row = document.createElement("div");
				row.className = "ec-line";
				const gutter = document.createElement("div");
				gutter.className = "gutter";
				const number = document.createElement("div");
				number.className = "ln";
				number.setAttribute("aria-hidden", "true");
				number.textContent = String(index + 1);
				const codeCell = document.createElement("div");
				codeCell.className = "code";
				const text = document.createElement("span");
				text.textContent = line || " ";
				codeCell.append(text);
				gutter.append(number);
				row.append(gutter, codeCell);
				return row;
			}),
		);
		pre?.style.setProperty("--ecMaxLine", `${Math.max(1, ...lines.map((line) => line.length))}ch`);
	}

	async function copyNativeCodeFrame(button) {
		const pre = button?.closest("pre");
		const code = pre?.querySelector("code");
		const text = Array.from(code?.querySelectorAll(".code:not(summary *)") ?? [])
			.map((element) => element.textContent)
			.map((line) => (line === "\n" ? "" : line))
			.join("\n");
		await navigator.clipboard?.writeText(text);

		const timeoutId = button.getAttribute("data-timeout-id");
		if (timeoutId) {
			window.clearTimeout(Number.parseInt(timeoutId, 10));
		}

		button.classList.add("success");
		const nextTimeoutId = window.setTimeout(() => {
			button.classList.remove("success");
			button.removeAttribute("data-timeout-id");
		}, 1000);
		button.setAttribute("data-timeout-id", String(nextTimeoutId));
	}

	function applySingleWidthImmediate() {
		if (!isSingleCanvasMode()) {
			return;
		}
		singleWidth = pendingSingleWidth;
		suppressGridApplyReveal = false;
		syncSyntaxView();
		updateGridSizeControl();
		markDirty();
	}

	function updateCanvasSyntaxControl() {
		const isCanvas = imageMode === "canvas";
		canvasFooterCenter?.toggleAttribute("hidden", !isCanvas);
		canvasSyntaxControl?.toggleAttribute("hidden", !isCanvas);
		tileSwapToggleButton?.toggleAttribute("hidden", !isCanvas);
		canvasNextActions?.toggleAttribute("hidden", !isCanvas);
		if (!isCanvas) {
			hideCanvasSyntaxPanel();
		}
		canvasSyntaxControl?.setAttribute("data-mode", canvasSyntaxMode);
		tileSwapToggleButton?.classList.toggle("active", tileSwapEnabled);
		tileSwapToggleButton?.setAttribute("aria-pressed", tileSwapEnabled ? "true" : "false");
		for (const button of canvasSyntaxModeButtons) {
			const active = button.dataset.canvasSyntaxMode === canvasSyntaxMode;
			button.classList.toggle("active", active);
			button.setAttribute("aria-pressed", active ? "true" : "false");
		}
	}

	function updateGridSizeControl() {
		if (!gridSizeControl) {
			return;
		}
		const isSingle = isSingleCanvasMode();
		const isGridCanvas = imageMode === "canvas" && canvasSyntaxMode === "grid";
		const isMosaicCanvas = imageMode === "canvas" && canvasSyntaxMode === "mosaic";
		const hasPendingSize = isSingle
			? pendingSingleWidth !== singleWidth
			: pendingGridColumns !== gridColumns || pendingGridRows !== gridRows;
		const hasPendingRatio =
			isGridCanvas &&
			(pendingGridCellRatioWidth !== gridCellRatioWidth || pendingGridCellRatioHeight !== gridCellRatioHeight);
		const activeMosaicRatio = mosaicRatioForRow(activeMosaicRowIndex);
		const hasPendingMosaicRatio =
			isMosaicCanvas &&
			(pendingMosaicRowRatioWidth !== activeMosaicRatio.width || pendingMosaicRowRatioHeight !== activeMosaicRatio.height);
		gridSizeControl.toggleAttribute("hidden", imageMode !== "canvas" || isMosaicCanvas);
		gridSizeControl.classList.toggle("has-pending-grid-size", hasPendingSize);
		gridSizeControl.classList.toggle("awaiting-pointer-reset", hasPendingSize && suppressGridApplyReveal);
		gridSizeControl.classList.toggle("single-width-mode", isSingle);
		gridRatioControl?.toggleAttribute("hidden", !isGridCanvas);
		gridRatioControl?.classList.toggle("has-pending-grid-size", hasPendingRatio);
		mosaicRatioControl?.toggleAttribute("hidden", !isMosaicCanvas);
		mosaicRatioControl?.classList.toggle("has-pending-grid-size", hasPendingMosaicRatio);
		const activeMosaicRow = isMosaicCanvas ? mosaicRows[activeMosaicRowIndex]?.imageIds ?? [] : [];
		const canSplitMosaicRow =
			isMosaicCanvas &&
			activeMosaicRow.some((imageId) => imagesById.has(imageId)) &&
			(activeMosaicRow.length > 1 || hasLaterMosaicImage(activeMosaicRowIndex));
		const canAppendToMosaicRow = isMosaicCanvas && hasLaterMosaicImage(activeMosaicRowIndex);
		mosaicRowActions?.toggleAttribute("hidden", !isMosaicCanvas);
		mosaicAddRowButton?.toggleAttribute("disabled", !canSplitMosaicRow);
		mosaicAddTileButton?.toggleAttribute("disabled", !canAppendToMosaicRow);
		if (gridWidthValue) {
			gridWidthValue.textContent = String(pendingGridColumns);
		}
		if (gridHeightValue) {
			gridHeightValue.textContent = String(pendingGridRows);
		}
		if (gridRatioWidthValue) {
			gridRatioWidthValue.textContent = String(pendingGridCellRatioWidth);
		}
		if (gridRatioHeightValue) {
			gridRatioHeightValue.textContent = String(pendingGridCellRatioHeight);
		}
		if (mosaicRatioWidthValue) {
			mosaicRatioWidthValue.textContent = String(pendingMosaicRowRatioWidth);
		}
		if (mosaicRatioHeightValue) {
			mosaicRatioHeightValue.textContent = String(pendingMosaicRowRatioHeight);
		}
		if (singleWidthValue) {
			singleWidthValue.textContent = String(pendingSingleWidth);
		}
		if (singleWidthInput) {
			singleWidthInput.value = String(pendingSingleWidth);
		}
		singleWidthDisplay?.toggleAttribute("hidden", !isSingle || singleWidthEditing);
		singleWidthInputShell?.toggleAttribute("hidden", !isSingle || !singleWidthEditing);
		gridSizeControl.querySelector(".grid-size-pair")?.toggleAttribute("hidden", isSingle);
		gridSizeApplyButton?.toggleAttribute("disabled", !hasPendingSize);
		syncCanvasFrame();
		gridTileContainer.style.setProperty("--grid-cell-ratio", `${gridCellRatioWidth} / ${gridCellRatioHeight}`);
	}

	function syncSyntaxView() {
		renderNativeCodeFrame(syntaxCodeFrame, buildContentMarkdown());
		updateCanvasSyntaxControl();
	}

	function generatedImageShortcuts() {
		const filledSlots = canvasFilledImageIds();
		if (imageMode === "off" || filledSlots.length === 0) {
			return "";
		}
		if (canvasSyntaxMode === "single") {
			const image = imagesById.get(filledSlots[0]);
			return image ? `:!img ${image.fileName} ${pendingSingleWidth}%` : "";
		}
		if (canvasSyntaxMode === "mosaic") {
			syncMosaicRowsFromImagePool();
			const lines = [":!mosaic 100%"];
			for (let rowIndex = 0; rowIndex < mosaicRows.length; rowIndex += 1) {
				const imageIds = (mosaicRows[rowIndex]?.imageIds ?? []).filter((imageId) => imagesById.has(imageId));
				if (imageIds.length === 0) {
					continue;
				}
				const ratio = mosaicRatioForRow(rowIndex);
				lines.push(`:/ ${ratio.width}/${ratio.height}`);
				for (const imageId of imageIds) {
					const image = imagesById.get(imageId);
					if (image) {
						lines.push(`:!img ${image.fileName}`);
					}
				}
			}
			lines.push("!:mosaic");
			return lines.join("\n");
		}
		const lines = [`:!grid ${gridColumns} ${gridRows} ${gridCellRatioWidth}/${gridCellRatioHeight}`];
		for (const imageId of filledSlots) {
			const image = imagesById.get(imageId);
			if (image) {
				lines.push(`:!img ${image.fileName}`);
			}
		}
		lines.push("!:grid");
		return lines.join("\n");
	}

	function imageBlockMarkdown() {
		if (imageMode === "off") {
			return "";
		}
		return generatedImageShortcuts();
	}

	function buildContentMarkdown() {
		const text = editorTextarea?.value.trimEnd() ?? "";
		const imageBlock = imageBlockMarkdown();
		return [text, imageBlock].filter(Boolean).join("\n\n");
	}

	function updateOutput() {
		syncSyntaxView();
	}

	function canvasToBlob(canvas, type, quality) {
		return new Promise((resolve, reject) => {
			canvas.toBlob(
				(blob) => {
					if (blob) {
						resolve(blob);
						return;
					}
					reject(new Error("Unable to encode image"));
				},
				type,
				quality,
			);
		});
	}

	async function encodeSafeImage(source, maxSize, type, quality) {
		const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
		const scale = Number.isFinite(maxSize) ? Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height)) : 1;
		const width = Math.max(1, Math.round(bitmap.width * scale));
		const height = Math.max(1, Math.round(bitmap.height * scale));
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext("2d");
		if (!context) {
			bitmap.close();
			throw new Error("Canvas is unavailable");
		}
		context.drawImage(bitmap, 0, 0, width, height);
		bitmap.close();
		const blob = await canvasToBlob(canvas, type, quality);
		return { blob, width, height };
	}

	async function sourceBlobForImage(image) {
		if (image.source) {
			return image.source;
		}
		if (!image.src) {
			throw new Error(`missing_image_source:${image.fileName}`);
		}
		const response = await fetch(image.src);
		if (!response.ok) {
			throw new Error(`image_fetch_failed:${image.fileName}`);
		}
		return response.blob();
	}

	async function prepareSafeImageAssets(image) {
		if (image.full && image.thumb) {
			return image;
		}
		const source = await sourceBlobForImage(image);
		const sourceType = source.type || image.source?.type || "";
		const canKeepOriginal =
			["jpg", "jpeg", "png"].includes(image.outputExtension) &&
			(sourceType === "image/jpeg" || sourceType === "image/png");
		const sourceDimensions = canKeepOriginal && (!image.width || !image.height) ? await measureImageSource(source) : null;
		const full = canKeepOriginal
			? { blob: source, width: image.width || sourceDimensions.width, height: image.height || sourceDimensions.height }
			: await encodeSafeImage(source, Infinity, mimeTypeForExtension(image.outputExtension || "png"), 0.9);
		const thumb = await encodeSafeImage(source, 560, "image/webp", 0.78);
		image.full = full.blob;
		image.thumb = thumb.blob;
		image.width = full.width;
		image.height = full.height;
		image.thumbWidth = thumb.width;
		image.thumbHeight = thumb.height;
		return image;
	}

	function recordsForImageIds(ids) {
		const seen = new Set();
		return ids
			.filter(Boolean)
			.map((imageId) => imagesById.get(imageId))
			.filter((image) => {
				if (!image || seen.has(image.id)) {
					return false;
				}
				seen.add(image.id);
				return true;
			});
	}

	function orderedImageRecords({ draft = false } = {}) {
		if (draft) {
			return recordsForImageIds(imageOrder);
		}
		if (imageMode === "off") {
			return [];
		}
		if (canvasSyntaxMode === "single") {
			return recordsForImageIds(canvasFilledImageIds().slice(0, 1));
		}
		if (canvasSyntaxMode === "mosaic") {
			syncMosaicRowsFromImagePool();
			return recordsForImageIds(flattenedMosaicImageIds());
		}
		return recordsForImageIds(canvasFilledImageIds());
	}

	async function prepareAllImageAssets({ draft = false, finalState = "ready" } = {}) {
		setDraftState("processing");
		for (const image of orderedImageRecords({ draft })) {
			await prepareSafeImageAssets(image);
		}
		setDraftState(finalState);
	}

	function syncExportFileNames({ draft = false } = {}) {
		eventId = currentEventId();
		const records = orderedImageRecords({ draft });
		for (let index = 0; index < records.length; index += 1) {
			const image = records[index];
			const extension = image.outputExtension || extensionForUploadedImage({ name: image.fileName, type: image.full?.type || image.source?.type || "" });
			image.fileName = `${eventId}-${index + 1}.${extension}`;
			image.thumbName = thumbNameForFileName(image.fileName);
			image.outputExtension = extension;
		}
		return records;
	}	function buildEventMarkdown() {
		const published = datetimeToIso(datetimeInput?.value ?? "");
		const location = metaEditor?.classList.contains("location-expanded") ? locationInput?.value.trim() : "";
		const lines = [
			"---",
			'type: "event"',
			`id: ${yamlString(eventId)}`,
			`published: ${published}`,
			"draft: true",
			`location: ${yamlString(location)}`,
			"---",
			"",
			buildContentMarkdown().trimEnd(),
			"",
		];
		return lines.join("\n");
	}

	async function buildDraftZip({ finalState = "ready" } = {}) {
		const imageRecords = syncExportFileNames({ draft: true });
		await prepareAllImageAssets({ draft: true, finalState });
		const files = {
			[draftMarkdownFileName(eventId)]: strToU8(buildEventMarkdown()),
		};
		for (const image of imageRecords) {
			if (!image.full || !image.thumb) {
				continue;
			}
			files[`images/${image.fileName}`] = new Uint8Array(await image.full.arrayBuffer());
			files[`images/${image.thumbName}`] = new Uint8Array(await image.thumb.arrayBuffer());
		}
		return new Blob([zipSync(files)], { type: "application/zip" });
	}

	async function publishEntry() {
		publishButton?.setAttribute("aria-busy", "true");
		const zip = await buildDraftZip({ finalState: "publishing" });
		const form = new FormData();
		form.set("draft", zip, draftZipFileName(eventId));
		const response = await fetch(publishEndpoint, { method: "POST", body: form, credentials: "include" });
		if (!response.ok) {
			throw new Error(await publishErrorMessage(response));
		}
		publishSucceeded = true;
		setDraftState("published");
	}	function parseFrontmatterMarkdown(text) {
		const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
		if (!match) {
			return { data: {}, body: text };
		}
		const data = {};
		for (const line of match[1].split(/\r?\n/)) {
			const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
			if (!field) {
				continue;
			}
			const value = field[2].trim();
			data[field[1]] = value.replace(/^["']|["']$/g, "");
		}
		return { data, body: text.slice(match[0].length).replace(/^(?:[ \t]*\r?\n)+/, "") };
	}

	function isDraftShortcutLine(line) {
		return (
			/^:!img\s+\S+(?:\s+\S+){0,3}$/.test(line) ||
			/^:!grid(?:\s+\S+){2,5}$/.test(line) ||
			/^:!mosaic(?:\s+\S+){0,3}$/.test(line) ||
			/^:\/(?:\s+\S+)?$/.test(line) ||
			/^!:(?:grid|mosaic)$/.test(line)
		);
	}

	function splitDraftBodyAndImageBlock(body) {
		const lines = body.trimEnd().split(/\r?\n/);
		let start = lines.length;
		while (start > 0 && (lines[start - 1].trim() === "" || isDraftShortcutLine(lines[start - 1].trim()))) {
			start -= 1;
		}
		const shortcutLines = lines.slice(start).map((line) => line.trim()).filter(Boolean);
		return {
			text: lines.slice(0, start).join("\n").trimEnd(),
			shortcutLines,
		};
	}

	function imageIdFromDraftFileName(fileName) {
		return fileName.replace(/\.[^.]+$/, "");
	}

	function restoreLayoutFromShortcuts(shortcutLines, fileNameToImageId) {
		if (shortcutLines.length === 0) {
			setImageMode(imagesById.size ? "canvas" : "off");
			return;
		}
		const first = shortcutLines[0]?.split(/\s+/) ?? [];
		const imageIds = shortcutLines
			.filter((line) => line.startsWith(":!img "))
			.map((line) => fileNameToImageId.get(line.split(/\s+/)[1]))
			.filter(Boolean);
		if (first[0] === ":!mosaic") {
			canvasSyntaxMode = "mosaic";
			mosaicRows = [];
			mosaicRowRatios = [];
			let currentRow = { imageIds: [] };
			let currentRatio = { width: 1, height: 1 };
			for (const line of shortcutLines.slice(1)) {
				const parts = line.split(/\s+/);
				if (parts[0] === ":/") {
					if (currentRow.imageIds.length > 0) {
						mosaicRows.push(currentRow);
						mosaicRowRatios.push(currentRatio);
					}
					currentRow = { imageIds: [] };
					currentRatio = parseGridRatio(parts[1], 1, 1);
				} else if (parts[0] === ":!img") {
					const imageId = fileNameToImageId.get(parts[1]);
					if (imageId) {
						currentRow.imageIds.push(imageId);
					}
				}
			}
			if (currentRow.imageIds.length > 0) {
				mosaicRows.push(currentRow);
				mosaicRowRatios.push(currentRatio);
			}
			setImageMode("canvas");
			return;
		}
		if (first[0] === ":!grid") {
			canvasSyntaxMode = "grid";
			gridColumns = Math.min(4, Math.max(1, Number(first[1]) || 2));
			gridRows = Math.min(4, Math.max(1, Number(first[2]) || 2));
			const ratio = parseGridRatio(first[3], 1, 1);
			gridCellRatioWidth = ratio.width;
			gridCellRatioHeight = ratio.height;
		} else {
			canvasSyntaxMode = "single";
		}
		gridSlots.fill(null);
		for (let index = 0; index < Math.min(gridSlots.length, imageIds.length); index += 1) {
			gridSlots[index] = imageIds[index];
		}
		setImageMode(imageIds.length ? "canvas" : "off");
	}

	function restoreDraft(zipBytes) {
		setDraftState("processing");
		const files = unzipSync(zipBytes);
		const markdownPaths = Object.keys(files).filter((name) => !name.includes("/") && name.toLowerCase().endsWith(".md"));
		if (markdownPaths.length !== 1) {
			throw new Error("invalid_draft_zip");
		}
		const markdownPath = markdownPaths[0];
		const parsedMarkdown = parseFrontmatterMarkdown(strFromU8(files[markdownPath]));
		eventId = parsedMarkdown.data.id || markdownPath.split("/").pop().replace(/\.md$/i, "");
		eventRandomSuffix = eventId.match(/-([a-z0-9]{8})$/)?.[1] ?? randomId();
		nextImageNumber = 1;
		for (const image of imagesById.values()) {
			if (image?.src?.startsWith("blob:")) {
				URL.revokeObjectURL(image.src);
			}
		}
		imagesById.clear();
		imageOrder.splice(0, imageOrder.length);
		gridSlots.fill(null);
		mosaicRows = [];
		if (datetimeInput && parsedMarkdown.data.published) {
			datetimeInput.value = isoToDatetimeValue(parsedMarkdown.data.published);
		}
		if (locationInput) {
			locationInput.value = parsedMarkdown.data.location || "";
		}
		setMetaMode(Boolean(parsedMarkdown.data.location), { focus: false });
		const { text: restoredContent, shortcutLines } = splitDraftBodyAndImageBlock(parsedMarkdown.body);
		if (editorTextarea) {
			editorTextarea.value = restoredContent;
		}
		const fileNameToImageId = new Map();
		for (const filePath of Object.keys(files).filter((name) => name.startsWith("images/") && !name.endsWith("_thumb.webp"))) {
			const fullBytes = files[filePath];
			const fileName = filePath.split("/").pop();
			const thumbName = thumbNameForFileName(fileName);
			const thumbBytes = files[`images/${thumbName}`];
			if (!fullBytes || !fileName) {
				continue;
			}
			const outputExtension = fileName.split(".").pop()?.toLowerCase() ?? "png";
			const full = new Blob([fullBytes], { type: mimeTypeForExtension(outputExtension) });
			const thumb = thumbBytes ? new Blob([thumbBytes], { type: "image/webp" }) : full;
			const imageId = imageIdFromDraftFileName(fileName);
			imagesById.set(imageId, {
				id: imageId,
				fileName,
				thumbName,
				src: URL.createObjectURL(full),
				source: full,
				outputExtension,
				full,
				thumb,
				width: 0,
				height: 0,
				thumbWidth: 0,
				thumbHeight: 0,
			});
			fileNameToImageId.set(fileName, imageId);
			imageOrder.push(imageId);
			nextImageNumber = Math.max(nextImageNumber, (Number(imageId.match(/-(\d+)$/)?.[1]) || 0) + 1);
		}
		restoreLayoutFromShortcuts(shortcutLines, fileNameToImageId);
		syncEventIdToDatetime();
		activeMosaicRowIndex = Math.min(mosaicRows.length - 1, Math.max(0, activeMosaicRowIndex));
		pendingMosaicRowRatioWidth = mosaicRatioForRow(activeMosaicRowIndex).width;
		pendingMosaicRowRatioHeight = mosaicRatioForRow(activeMosaicRowIndex).height;
		renderTiles();
		renderImageStrip();
		updateOutput();
		markDirty();
		setDraftState("ready");
	}

	function setImageMode(mode) {
		imageMode = mode === "syntax" ? "syntax" : mode === "canvas" ? "canvas" : "off";
		pendingGridColumns = gridColumns;
		pendingGridRows = gridRows;
		pendingGridCellRatioWidth = gridCellRatioWidth;
		pendingGridCellRatioHeight = gridCellRatioHeight;
		pendingSingleWidth = singleWidth;
		syncMosaicSelectionState();
		singleWidthEditing = false;
		suppressGridApplyReveal = false;
		if (imageMode === "canvas") {
			syncGridSlotsFromImagePool();
		}
		imageSegmentedControl?.setAttribute("data-mode", imageMode);
		imagePanel?.classList.toggle("collapsed", imageMode === "off");
		for (const button of modeButtons) {
			button.classList.toggle("active", button.dataset.editorMode === imageMode);
		}
		updateImageModeAvailability();
		panes.canvas?.classList.toggle("active", imageMode === "canvas");
		panes.syntax?.classList.toggle("active", imageMode === "syntax");
		canvasNextActions?.toggleAttribute("hidden", imageMode !== "canvas");
		syntaxBackButton?.toggleAttribute("hidden", imageMode !== "syntax");
		updateCanvasSyntaxControl();
		updateGridSizeControl();
		updateOutput();
	}

	function applyGridSize() {
		if (isSingleCanvasMode()) {
			singleWidth = pendingSingleWidth;
		} else {
			gridColumns = pendingGridColumns;
			gridRows = pendingGridRows;
			gridCellRatioWidth = pendingGridCellRatioWidth;
			gridCellRatioHeight = pendingGridCellRatioHeight;
		}
		suppressGridApplyReveal = false;
		syncGridSlotsFromImagePool();
		renderAllImages();
		clearTileSelection();
		markDirty();
	}

	function setMetaMode(locationExpanded, { focus = true } = {}) {
		if (!metaEditor) {
			return;
		}
		metaEditor.classList.toggle("location-expanded", locationExpanded);
		toggleLocationButton?.toggleAttribute("disabled", locationExpanded);
		toggleLocationButton?.setAttribute("aria-disabled", locationExpanded ? "true" : "false");
		toggleLocationButton?.setAttribute(
			"aria-label",
			locationExpanded ? "Hide location" : "Show location",
		);
		updateDatetimeCaret();
		if (locationExpanded && focus) {
			window.setTimeout(() => {
				locationInput?.focus();
			}, metaTransitionMs);
		} else if (!locationExpanded && document.activeElement === locationInput) {
			locationInput?.blur();
		}
	}

	function toggleLocationMode() {
		setMetaMode(!metaEditor?.classList.contains("location-expanded"));
		markDirty();
	}

	function handleLocationFocusRequest(event) {
		if (event.target?.closest?.("#toggle-location-button")) {
			return;
		}
		if (!metaEditor?.classList.contains("location-expanded")) {
			event.preventDefault();
			setMetaMode(true);
			markDirty();
			return;
		}
		window.setTimeout(() => {
			locationInput?.focus();
			updateDatetimeCaret();
		}, 0);
	}

	function collapseEmptyLocationOnOutsidePointer(event) {
		if (
			!metaEditor?.classList.contains("location-expanded") ||
			locationInput?.value.trim()
		) {
			return;
		}
		if (event.target?.closest?.(".meta-location")) {
			return;
		}
		setMetaMode(false);
		markDirty();
	}

	function requestImageUpload(target) {
		if (imageOrder.length >= maxImages && !target.replaceImageId) {
			alert(`Image limit is ${maxImages}.`);
			return;
		}
		pendingUploadTarget = target;
		imageFileInput?.click();
	}

	async function addImageFile(file, uploadTarget) {
		const replaceIndex = Number.isInteger(uploadTarget.index) ? uploadTarget.index : -1;
		const replacedMosaicPositions = uploadTarget.replaceImageId
			? mosaicRows.flatMap((row, rowIndex) =>
					(row.imageIds ?? [])
						.map((imageId, imageIndex) =>
							imageId === uploadTarget.replaceImageId ? { rowIndex, imageIndex } : null,
						)
						.filter(Boolean),
				)
			: [];
		const replacedGridSlots = uploadTarget.replaceImageId
			? gridSlots
					.map((imageId, index) => (imageId === uploadTarget.replaceImageId ? index : -1))
					.filter((index) => index !== -1)
			: [];
		if (uploadTarget.replaceImageId) {
			removeImageFromPool(uploadTarget.replaceImageId);
		}
		const names = makeImageNames();
		const outputExtension = extensionForUploadedImage(file);
		names.fileName = `${names.id}.${outputExtension}`;
		names.thumbName = thumbNameForFileName(names.fileName);
		const src = URL.createObjectURL(file);
		let dimensions = { width: 0, height: 0 };
		try {
			dimensions = await measureImageSource(file);
		} catch {}
		const image = {
			...names,
			src,
			source: file,
			originalName: file.name,
			outputExtension,
			full: null,
			thumb: null,
			width: dimensions.width,
			height: dimensions.height,
			thumbWidth: 0,
			thumbHeight: 0,
		};
		imagesById.set(image.id, image);
		if (uploadTarget.area === "pool" && replaceIndex >= 0) {
			imageOrder.splice(Math.min(replaceIndex, imageOrder.length), 0, image.id);
		} else if (!imageOrder.includes(image.id)) {
			imageOrder.push(image.id);
		}
		if (uploadTarget.area === "grid") {
			gridSlots[uploadTarget.index] = image.id;
		} else if (uploadTarget.area === "mosaic" && replacedMosaicPositions.length > 0) {
			for (const position of replacedMosaicPositions) {
				while (mosaicRows.length <= position.rowIndex) {
					mosaicRows.push({ imageIds: [] });
				}
				mosaicRows[position.rowIndex].imageIds.splice(
					Math.min(position.imageIndex, mosaicRows[position.rowIndex].imageIds.length),
					0,
					image.id,
				);
			}
		} else if (uploadTarget.area === "mosaic" && Number.isInteger(uploadTarget.rowIndex)) {
			while (mosaicRows.length <= uploadTarget.rowIndex) {
				mosaicRows.push({ imageIds: [] });
			}
			mosaicRows[uploadTarget.rowIndex].imageIds.push(image.id);
		} else if (uploadTarget.area === "pool" && replacedGridSlots.length > 0) {
			for (const index of replacedGridSlots) {
				gridSlots[index] = image.id;
			}
		} else {
			const emptyIndex = firstEmptyGridSlot();
			if (emptyIndex !== -1) {
				gridSlots[emptyIndex] = image.id;
			}
		}
		originalTileFiles.set(image, file);
		return image;
	}

	async function importImageFiles(files, uploadTarget = { area: "append" }) {
		const selectedFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
		if (selectedFiles.length === 0) {
			return;
		}
		const filesToImport = uploadTarget.replaceImageId ? selectedFiles.slice(0, 1) : selectedFiles;
		const nextCount = imageOrder.length + filesToImport.length - (uploadTarget.replaceImageId ? 1 : 0);
		if (nextCount > maxImages) {
			alert(`Image limit is ${maxImages}. Nothing was imported.`);
			return;
		}
		for (const file of filesToImport) {
			await addImageFile(file, uploadTarget);
			if (uploadTarget.replaceImageId) {
				break;
			}
		}
		selectCanvasSyntaxModeForImageCount();
		setImageMode("canvas");
		syncGridSlotsFromImagePool();
		renderAllImages();
		clearTileSelection();
		markDirty();
	}

	function firstEmptyGridSlot() {
		return gridSlots.findIndex((imageId, index) => index < gridCapacity() && !imageId);
	}

	function syncGridSlotsFromImagePool() {
		const visibleSlots = gridSlots.slice(0, gridCapacity());
		const usedImageIds = new Set(visibleSlots.filter(Boolean));
		let nextPoolIndex = 0;
		for (let index = 0; index < visibleSlots.length; index += 1) {
			if (gridSlots[index]) {
				continue;
			}
			while (nextPoolIndex < imageOrder.length && usedImageIds.has(imageOrder[nextPoolIndex])) {
				nextPoolIndex += 1;
			}
			const imageId = imageOrder[nextPoolIndex];
			if (!imageId) {
				return;
			}
			gridSlots[index] = imageId;
			usedImageIds.add(imageId);
			nextPoolIndex += 1;
		}
	}

	function handleGridTileClick(tile, event) {
		event.stopPropagation();
		if (imageMode === "canvas" && canvasSyntaxMode === "mosaic") {
			activeMosaicRowIndex = mosaicRowIndexForTile(tile);
			syncMosaicSelectionState();
			updateGridSizeControl();
			const imageId = imageIdForTile(tile);
			if (selectedTile === tile) {
				if (!imageId) {
					requestImageUpload({ area: "mosaic", rowIndex: activeMosaicRowIndex });
					return;
				}
				if (tileSwapEnabled) {
					requestImageUpload({ area: "mosaic", replaceImageId: imageId });
					return;
				}
				openImageGallery(imageId);
				return;
			}
			if (tileSwapEnabled && selectedTile && tileArea(selectedTile) === "grid" && tileHasImage(selectedTile)) {
				const firstImageId = imageIdForTile(selectedTile);
				if (firstImageId && imageId && firstImageId !== imageId) {
					for (const row of mosaicRows) {
						row.imageIds = (row.imageIds ?? []).map((rowImageId) =>
							rowImageId === firstImageId ? imageId : rowImageId === imageId ? firstImageId : rowImageId,
						);
					}
					renderAllImages();
					clearTileSelection();
					markDirty();
					return;
				}
			}
			selectTile(tile);
			return;
		}
		const index = tileIndex(tile);
		const imageId = gridSlots[index];
		if (!imageId) {
			requestImageUpload({ area: "grid", index });
			return;
		}
		if (selectedTile === tile) {
			if (tileSwapEnabled) {
				requestImageUpload({ area: "grid", index, replaceImageId: imageId });
				return;
			}
			openImageGallery(imageId);
			return;
		}
		if (tileSwapEnabled && selectedTile && tileArea(selectedTile) === "grid" && tileHasImage(selectedTile)) {
			const firstIndex = tileIndex(selectedTile);
			[gridSlots[firstIndex], gridSlots[index]] = [gridSlots[index], gridSlots[firstIndex]];
			renderAllImages();
			clearTileSelection();
			markDirty();
			return;
		}
		selectTile(tile);
	}

	function handlePoolTileClick(tile, event) {
		event.stopPropagation();
		if (tileArea(tile) === "pool-add") {
			requestImageUpload({ area: "append" });
			return;
		}
		const imageId = imageIdForTile(tile);
		if (selectedTile === tile && imageId) {
			openImageGallery(imageId);
			return;
		}
		selectTile(tile);
	}

	document.querySelector("#canvas-editor")?.addEventListener("click", (event) => {
		const tile = event.target?.closest?.(".image-tile");
		if (tile) {
			handleGridTileClick(tile, event);
		}
	});

	document.querySelector("#syntax-editor .image-strip")?.addEventListener("click", (event) => {
		const tile = event.target?.closest?.(".image-tile");
		if (tile) {
			handlePoolTileClick(tile, event);
		}
	});

	document.addEventListener("pointerdown", (event) => {
		if (event.target?.closest?.(".image-tile, #image-add-button, #image-trash-button, .image-clipboard-control, .grid-size-control")) {
			return;
		}
		clearTileSelection();
	}, { capture: true });

	gridSizeControl?.addEventListener("pointerdown", (event) => {
		const number = event.target?.closest?.(".grid-size-number");
		if (!number || imageMode !== "canvas") {
			return;
		}
		event.preventDefault();
		suppressGridApplyReveal =
			number.dataset.gridAxis === "width"
				? pendingSingleWidth === singleWidth
				: pendingGridColumns === gridColumns && pendingGridRows === gridRows;
		activeGridDrag = {
			pointerId: event.pointerId,
			axis: number.dataset.gridAxis,
			anchor: number.closest(".grid-size-control"),
			startY: event.clientY,
			lastOffset: 0,
			startRatioIndex: gridRatioPresetIndex(pendingGridCellRatioWidth, pendingGridCellRatioHeight),
		};
		number.setPointerCapture?.(event.pointerId);
		updateGridSizeControl();
	});

	gridRatioControl?.addEventListener("pointerdown", (event) => {
		const number = event.target?.closest?.(".grid-size-number");
		if (!number || imageMode !== "canvas" || canvasSyntaxMode !== "grid") {
			return;
		}
		event.preventDefault();
		suppressGridApplyReveal =
			pendingGridCellRatioWidth === gridCellRatioWidth && pendingGridCellRatioHeight === gridCellRatioHeight;
		activeGridDrag = {
			pointerId: event.pointerId,
			axis: number.dataset.gridAxis,
			anchor: number.closest(".grid-size-control"),
			startY: event.clientY,
			lastOffset: 0,
			startRatioIndex: gridRatioPresetIndex(pendingGridCellRatioWidth, pendingGridCellRatioHeight),
		};
		number.setPointerCapture?.(event.pointerId);
		updateGridSizeControl();
	});

	mosaicRatioControl?.addEventListener("pointerdown", (event) => {
		const number = event.target?.closest?.(".grid-size-number");
		if (!number || imageMode !== "canvas" || canvasSyntaxMode !== "mosaic") {
			return;
		}
		event.preventDefault();
		syncMosaicSelectionState();
		activeGridDrag = {
			pointerId: event.pointerId,
			axis: number.dataset.gridAxis,
			anchor: number.closest(".grid-size-control"),
			startY: event.clientY,
			lastOffset: 0,
			startRatioIndex: gridRatioPresetIndex(pendingMosaicRowRatioWidth, pendingMosaicRowRatioHeight),
		};
		number.setPointerCapture?.(event.pointerId);
		updateGridSizeControl();
	});

	document.addEventListener("pointermove", (event) => {
		if (!activeGridDrag || event.pointerId !== activeGridDrag.pointerId || imageMode !== "canvas") {
			return;
		}
		event.preventDefault();
		const offset = Math.trunc((activeGridDrag.startY - event.clientY) / 20);
		if (offset === activeGridDrag.lastOffset) {
			return;
		}
		const delta = offset - activeGridDrag.lastOffset;
		activeGridDrag.lastOffset = offset;
		if (activeGridDrag.axis === "width") {
			pendingSingleWidth = clampSingleWidth(pendingSingleWidth + delta);
			applySingleWidthImmediate();
		} else if (activeGridDrag.axis === "columns") {
			pendingGridColumns = clampGridSize(pendingGridColumns + delta);
		} else if (activeGridDrag.axis === "rows") {
			pendingGridRows = clampGridSize(pendingGridRows + delta);
		} else if (activeGridDrag.axis === "ratio") {
			const nextIndex = Math.min(
				gridRatioPresets.length - 1,
				Math.max(0, activeGridDrag.startRatioIndex + offset),
			);
			const [presetWidth, presetHeight] = gridRatioPresets[nextIndex];
			const [nextWidth, nextHeight] = orientGridRatio(presetWidth, presetHeight);
			pendingGridCellRatioWidth = nextWidth;
			pendingGridCellRatioHeight = nextHeight;
		} else if (activeGridDrag.axis === "mosaic-ratio") {
			const nextIndex = Math.min(
				gridRatioPresets.length - 1,
				Math.max(0, activeGridDrag.startRatioIndex + offset),
			);
			const [presetWidth, presetHeight] = gridRatioPresets[nextIndex];
			pendingMosaicRowRatioWidth = presetWidth;
			pendingMosaicRowRatioHeight = presetHeight;
		}
		updateGridSizeControl();
	});

	document.addEventListener("pointerup", (event) => {
		if (!activeGridDrag || event.pointerId !== activeGridDrag.pointerId) {
			return;
		}
		const shouldEnterSingleInput =
			isSingleCanvasMode() && activeGridDrag.axis === "width" && activeGridDrag.lastOffset === 0;
		const shouldApplyGridRatio =
			activeGridDrag.axis === "ratio" &&
			(activeGridDrag.lastOffset !== 0 ||
				pendingGridCellRatioWidth !== gridCellRatioWidth ||
				pendingGridCellRatioHeight !== gridCellRatioHeight);
		const shouldApplyMosaicRatio =
			activeGridDrag.axis === "mosaic-ratio" &&
			(activeGridDrag.lastOffset !== 0 ||
				pendingMosaicRowRatioWidth !== mosaicRatioForRow(activeMosaicRowIndex).width ||
				pendingMosaicRowRatioHeight !== mosaicRatioForRow(activeMosaicRowIndex).height);
		const viewportAnchor = activeGridDrag.anchor;
		suppressGridApplyReveal = false;
		activeGridDrag = null;
		if (shouldApplyGridRatio) {
			gridCellRatioWidth = pendingGridCellRatioWidth;
			gridCellRatioHeight = pendingGridCellRatioHeight;
		}
		if (shouldApplyMosaicRatio) {
			mosaicRowRatios[activeMosaicRowIndex] = {
				width: pendingMosaicRowRatioWidth,
				height: pendingMosaicRowRatioHeight,
			};
		}
		updateGridSizeControl();
		if (shouldApplyGridRatio || shouldApplyMosaicRatio) {
			withViewportAnchor(viewportAnchor, () => {
				suppressCanvasTileHoverUntilPointerLeaves(event);
				if (shouldApplyMosaicRatio) {
					renderAllImages();
				}
				updateOutput();
				markDirty();
			});
		}
		if (shouldEnterSingleInput) {
			beginSingleWidthEditing();
		}
	});

	document.addEventListener("pointercancel", (event) => {
		if (!activeGridDrag || event.pointerId !== activeGridDrag.pointerId) {
			return;
		}
		suppressGridApplyReveal = false;
		activeGridDrag = null;
		updateGridSizeControl();
	});

	gridSizeApplyButton?.addEventListener("click", () => {
		if (imageMode !== "canvas") {
			return;
		}
		withViewportAnchor(gridSizeControl, applyGridSize);
	});

	gridRatioRotateButton?.addEventListener("click", () => {
		if (imageMode !== "canvas" || canvasSyntaxMode !== "grid") {
			return;
		}
		withViewportAnchor(gridRatioControl, () => {
			gridRatioPortraitMode = !gridRatioPortraitMode;
			[gridCellRatioWidth, gridCellRatioHeight] = [gridCellRatioHeight, gridCellRatioWidth];
			pendingGridCellRatioWidth = gridCellRatioWidth;
			pendingGridCellRatioHeight = gridCellRatioHeight;
			suppressGridApplyReveal = false;
			updateGridSizeControl();
			updateOutput();
			markDirty();
		});
	});

	mosaicRatioSwapButton?.addEventListener("click", () => {
		if (imageMode !== "canvas" || canvasSyntaxMode !== "mosaic") {
			return;
		}
		withViewportAnchor(mosaicRatioControl, () => {
			syncMosaicSelectionState();
			const ratio = mosaicRatioForRow(activeMosaicRowIndex);
			mosaicRowRatios[activeMosaicRowIndex] = {
				width: ratio.height,
				height: ratio.width,
			};
			pendingMosaicRowRatioWidth = ratio.height;
			pendingMosaicRowRatioHeight = ratio.width;
			renderAllImages();
			updateOutput();
			markDirty();
		});
	});

	mosaicAddRowButton?.addEventListener("click", () => {
		if (imageMode !== "canvas" || canvasSyntaxMode !== "mosaic") {
			return;
		}
		syncMosaicSelectionState();
		const rowIndex = activeMosaicRowIndex;
		const row = mosaicRows[rowIndex];
		if (!row) {
			return;
		}
		let movedImageId = null;
		const imageId =
			selectedTile && tileArea(selectedTile) === "grid" && mosaicRowIndexForTile(selectedTile) === rowIndex
				? selectedTile.dataset.imageId
				: null;
		const selectedImageIndex = imageId ? row.imageIds.indexOf(imageId) : -1;
		if (row.imageIds.length > 1 && selectedImageIndex !== -1) {
			[movedImageId] = row.imageIds.splice(selectedImageIndex, 1);
		} else if (row.imageIds.length > 1) {
			movedImageId = row.imageIds.pop() ?? null;
		} else {
			movedImageId = takeFirstLaterMosaicImage(rowIndex)?.imageId ?? null;
		}
		if (!movedImageId) {
			return;
		}
		withViewportAnchor(mosaicRowActions, () => {
			mosaicRows.splice(rowIndex + 1, 0, { imageIds: [movedImageId] });
			mosaicRowRatios.splice(rowIndex + 1, 0, { ...mosaicRatioForRow(rowIndex) });
			activeMosaicRowIndex = rowIndex + 1;
			pruneEmptyMosaicRows();
			renderAllImages();
			syncMosaicSelectionState();
			updateGridSizeControl();
			updateOutput();
			markDirty();
		});
	});

	mosaicAddTileButton?.addEventListener("click", () => {
		if (imageMode !== "canvas" || canvasSyntaxMode !== "mosaic") {
			return;
		}
		syncMosaicSelectionState();
		const rowIndex = activeMosaicRowIndex;
		const moved = takeFirstLaterMosaicImage(rowIndex);
		if (!moved?.imageId || !mosaicRows[rowIndex]) {
			return;
		}
		withViewportAnchor(mosaicRowActions, () => {
			mosaicRows[rowIndex].imageIds.push(moved.imageId);
			activeMosaicRowIndex = rowIndex;
			pruneEmptyMosaicRows();
			renderAllImages();
			syncMosaicSelectionState();
			updateGridSizeControl();
			updateOutput();
			markDirty();
		});
	});

	tileSwapToggleButton?.addEventListener("click", () => {
		tileSwapEnabled = !tileSwapEnabled;
		if (!tileSwapEnabled) {
			clearTileSelection();
		}
		updateCanvasSyntaxControl();
	});

	canvasSyntaxControl?.addEventListener("mouseenter", showCanvasSyntaxPanel);
	canvasSyntaxControl?.addEventListener("mouseleave", hideCanvasSyntaxPanel);
	canvasSyntaxButton?.addEventListener("click", (event) => {
		event.preventDefault();
		withViewportAnchor(canvasSyntaxControl, () => {
			const modes = ["single", "mosaic", "grid"];
			const currentIndex = Math.max(0, modes.indexOf(canvasSyntaxMode));
			canvasSyntaxMode = modes[(currentIndex + 1) % modes.length];
			singleWidthEditing = false;
			pendingSingleWidth = singleWidth;
			pendingGridCellRatioWidth = gridCellRatioWidth;
			pendingGridCellRatioHeight = gridCellRatioHeight;
			syncMosaicSelectionState();
			syncGridSlotsFromImagePool();
			renderAllImages();
			clearTileSelection();
			updateCanvasSyntaxControl();
			updateGridSizeControl();
			markDirty();
		});
	});

	for (const button of canvasSyntaxModeButtons) {
		button.addEventListener("click", () => {
			withViewportAnchor(canvasSyntaxControl, () => {
				canvasSyntaxMode = button.dataset.canvasSyntaxMode || "grid";
				singleWidthEditing = false;
				pendingSingleWidth = singleWidth;
				pendingGridCellRatioWidth = gridCellRatioWidth;
				pendingGridCellRatioHeight = gridCellRatioHeight;
				syncMosaicSelectionState();
				hideCanvasSyntaxPanel();
				syncGridSlotsFromImagePool();
				renderAllImages();
				clearTileSelection();
				updateCanvasSyntaxControl();
				updateGridSizeControl();
				markDirty();
			});
		});
	}

	document.addEventListener("pointerdown", (event) => {
		if (!canvasSyntaxControl?.contains(event.target)) {
			hideCanvasSyntaxPanel();
		}
	});

	singleWidthInput?.addEventListener("input", () => {
		singleWidthInput.value = singleWidthInput.value.replace(/[^\d]/g, "").slice(0, 3);
		pendingSingleWidth = clampSingleWidth(Number.parseInt(singleWidthInput.value, 10) || singleWidth);
		applySingleWidthImmediate();
	});
	singleWidthInput?.addEventListener("keydown", (event) => {
		if (event.key === "Enter") {
			event.preventDefault();
			finishSingleWidthEditing({ commit: true });
		} else if (event.key === "Escape") {
			event.preventDefault();
			finishSingleWidthEditing({ commit: false });
		}
	});
	singleWidthInput?.addEventListener("blur", () => {
		if (singleWidthEditing) {
			finishSingleWidthEditing({ commit: true });
		}
	});

	imageAddButton?.addEventListener("click", () => {
		requestImageUpload({ area: "append" });
	});

	canvasNextButton?.addEventListener("click", () => {
		if (imageMode !== "canvas") {
			return;
		}
		setImageMode("syntax");
		markDirty();
	});

	imageTrashButton?.addEventListener("click", () => {
		window.clearTimeout(imageTrashTimer);
		if (imageTrashButton.dataset.pendingClear === "true") {
			imageTrashButton.dataset.pendingClear = "false";
			clearAllTiles();
			setImageMode("off");
			return;
		}
		imageTrashButton.dataset.pendingClear = "true";
		imageTrashTimer = window.setTimeout(() => {
			imageTrashButton.dataset.pendingClear = "false";
			if (selectedTile) {
				clearTile(selectedTile);
			}
		}, 240);
	});

	imageFileInput?.addEventListener("change", async () => {
		const files = imageFileInput.files;
		if (!files?.length || !pendingUploadTarget) {
			return;
		}
		try {
			await importImageFiles(files, pendingUploadTarget);
		} finally {
			pendingUploadTarget = null;
			imageFileInput.value = "";
		}
	});

	imagePanel?.addEventListener("dragover", (event) => {
		if (!imagePanel.classList.contains("collapsed")) {
			return;
		}
		event.preventDefault();
	});

	imagePanel?.addEventListener("drop", async (event) => {
		if (!imagePanel.classList.contains("collapsed")) {
			return;
		}
		event.preventDefault();
		await importImageFiles(event.dataTransfer?.files ?? [], { area: "append" });
	});

	metaLocation?.addEventListener("pointerdown", handleLocationFocusRequest, { capture: true });
	toggleLocationButton?.addEventListener("pointerdown", (event) => {
		event.stopPropagation();
	});
	toggleLocationButton?.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
		toggleLocationMode();
	});
	document.addEventListener("pointerdown", collapseEmptyLocationOnOutsidePointer, { capture: true });

	setNowButton?.addEventListener("click", () => {
		if (!datetimeInput) {
			return;
		}
		datetimeInput.value = datetimeValue();
		datetimeInput.focus();
		syncEventIdToDatetime();
		renderAllImages();
		markDirty();
		updateDatetimeCaret();
	});

	datetimeInput?.addEventListener("keydown", (event) => {
		if (!datetimeInput) {
			return;
		}
		if (event.ctrlKey || event.metaKey) {
			if (["a", "c", "v"].includes(event.key.toLowerCase())) {
				return;
			}
			event.preventDefault();
			return;
		}
		if (/^\d$/.test(event.key)) {
			event.preventDefault();
			setDatetimeDigit(datetimeInput, datetimeInput.selectionStart ?? 0, event.key);
			return;
		}
		if (event.key === "Backspace" || event.key === "Delete") {
			event.preventDefault();
			clearDatetimeDigit(datetimeInput, event.key === "Backspace" ? "backward" : "forward");
			return;
		}
		if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
			event.preventDefault();
			const direction = event.key === "ArrowLeft" ? -1 : 1;
			const cursor = datetimeInput.selectionStart ?? 0;
			const nextIndex = getClosestDatetimeDigitIndex(cursor + direction, direction);
			datetimeInput.setSelectionRange(nextIndex, nextIndex);
			updateDatetimeCaret();
			return;
		}
		if (event.key === "Home" || event.key === "End") {
			event.preventDefault();
			datetimeInput.setSelectionRange(event.key === "Home" ? 0 : 15, event.key === "Home" ? 0 : 15);
			updateDatetimeCaret();
			return;
		}
		if (!["Tab", "Shift", "Control", "Alt", "Meta", "Escape", "Enter"].includes(event.key)) {
			event.preventDefault();
		}
	});

	datetimeInput?.addEventListener("beforeinput", (event) => {
		if (!datetimeInput || !(event instanceof InputEvent)) {
			return;
		}
		if (event.inputType.startsWith("delete")) {
			event.preventDefault();
			clearDatetimeDigit(
				datetimeInput,
				event.inputType.toLowerCase().includes("backward") ? "backward" : "forward",
			);
			return;
		}
		if (event.inputType === "insertText") {
			event.preventDefault();
			if (/^\d$/.test(event.data ?? "")) {
				setDatetimeDigit(datetimeInput, datetimeInput.selectionStart ?? 0, event.data);
			}
		}
	});

	datetimeInput?.addEventListener("input", () => {
		datetimeInput.value = normalizeDatetimeValue(datetimeInput.value);
		syncEventIdToDatetime();
		renderAllImages();
		markDirty();
		updateDatetimeCaret();
	});

	datetimeInput?.addEventListener("paste", (event) => {
		if (!datetimeInput) {
			return;
		}
		event.preventDefault();
		const pastedDigits = event.clipboardData?.getData("text").replace(/\D/g, "");
		if (!pastedDigits) {
			return;
		}
		const chars = datetimeInput.value.split("");
		let digitCursor = 0;
		for (const index of datetimeDigitIndexes) {
			if (index < (datetimeInput.selectionStart ?? 0)) {
				continue;
			}
			if (!pastedDigits[digitCursor]) {
				break;
			}
			chars[index] = pastedDigits[digitCursor];
			digitCursor += 1;
		}
		datetimeInput.value = normalizeDatetimeValue(chars.join(""));
		const nextIndex =
			datetimeDigitIndexes.find((index) => index >= (datetimeInput.selectionStart ?? 0) + digitCursor) ?? 15;
		datetimeInput.setSelectionRange(nextIndex, nextIndex);
		syncEventIdToDatetime();
		renderAllImages();
		markDirty();
		updateDatetimeCaret();
	});

	datetimeInput?.addEventListener("focus", () => {
		datetimeInput.value = normalizeDatetimeValue(datetimeInput.value);
		const index = getClosestDatetimeDigitIndex(datetimeInput.selectionStart ?? 0);
		datetimeInput.setSelectionRange(index, index);
		updateDatetimeCaret();
	});
	datetimeInput?.addEventListener("click", () => {
		const index = getClosestDatetimeDigitIndex(datetimeInput.selectionStart ?? 0);
		datetimeInput.setSelectionRange(index, index);
		updateDatetimeCaret();
	});
	datetimeInput?.addEventListener("drop", (event) => event.preventDefault());
	datetimeInput?.addEventListener("blur", updateDatetimeCaret);
	window.addEventListener("resize", updateDatetimeCaret);

	for (const button of modeButtons) {
		button.addEventListener("click", () => {
			if (button.disabled) {
				return;
			}
			const mode =
				button.dataset.editorMode === "syntax"
					? "syntax"
					: button.dataset.editorMode === "canvas"
						? "canvas"
						: "off";
			setImageMode(mode);
			publishSucceeded = false;
			setDraftState(mode === "off" ? "ready" : "processing");
			if (mode !== "off") {
				window.setTimeout(() => {
					if (draftState === "processing") {
						setDraftState("ready");
					}
				}, 900);
			}
		});
	}

	syntaxBackButton?.addEventListener("click", () => {
		setImageMode("canvas");
		renderAllImages();
		clearTileSelection();
	});

	document.addEventListener("click", async (event) => {
		const button = event.target?.closest?.(".native-code-frame .copy-btn");
		if (!button) {
			return;
		}
		event.preventDefault();
		await copyNativeCodeFrame(button);
	});

	downloadDraftButton?.addEventListener("click", async () => {
		try {
			const zip = await buildDraftZip();
			downloadBlob(zip, draftZipFileName(eventId));
		} catch (error) {
			console.error(error);
			setDraftState("ready");
			alert(error instanceof Error ? error.message : "Unable to create draft zip");
		}
	});

	openDraftButton?.addEventListener("click", () => draftFileInput?.click());
	draftFileInput?.addEventListener("change", async () => {
		const file = draftFileInput.files?.[0];
		if (!file) {
			return;
		}
		try {
			restoreDraft(new Uint8Array(await file.arrayBuffer()));
		} catch (error) {
			console.error(error);
			setDraftState("ready");
			alert(error instanceof Error ? error.message : "Unable to open draft zip");
		} finally {
			draftFileInput.value = "";
		}
	});

	publishButton?.addEventListener("click", async () => {
		window.clearTimeout(publishTimer);
		try {
			await publishEntry();
		} catch (error) {
			console.error(error);
			setDraftState("ready");
			alert(error instanceof Error ? error.message : "Publish failed");
		} finally {
			publishButton.removeAttribute("aria-busy");
		}
	});

	editorTextarea?.addEventListener("input", markDirty);
	initEditorScrollbar();
	fitEditorTextarea();
	locationInput?.addEventListener("input", markDirty);
	window.addEventListener("beforeunload", (event) => {
		if (publishSucceeded) {
			return;
		}
		event.preventDefault();
		event.returnValue = "";
	});
	resetEditorOnEntry();
	disableSwupFromPublish();
	setImageMode("off");
	renderAllImages();
	updateDatetimeCaret();
	window.timelinePublish = { prepareSafeImageAssets, originalTileFiles };

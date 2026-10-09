import { useState, useEffect, useRef } from "react";
import Panzoom from "@panzoom/panzoom";
import { ValidationError } from "./utils";
import "./App.css";

function App() {
  const [file, setFile] = useState(undefined);
  const [pan, setPan] = useState(undefined);
  const [importFormData, setImportFormData] = useState({ boundaryImport: "" });
  const [importError, setImportError] = useState("");
  const [exportData, setExportData] = useState("");
  const panRef = useRef({ x: 0, y: 0, scale: 1 });
  const [boundingBoxes, setBoundingBoxes] = useState([]);
  const [focusedBox, setFocusedBox] = useState("");
  const [draw, setDraw] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);

  useEffect(() => {
    if (file) {
      setupPan();
    }
    return () => {
      destroyPan();
    };
  }, [file]);

  useEffect(() => {
    handleExport();
  }, [boundingBoxes]);

  const handlePan = () => {
    if (pan) {
      destroyPan();
    } else {
      setupPan();
    }
  };

  const setupPan = () => {
    const elem = document.getElementById("img-viewer-container");
    if (elem) {
      const panzoom = Panzoom(elem, {
        maxScale: 3,
        minScale: 0.5,
        step: 1,
        startX: panRef.current.x,
        startY: panRef.current.y,
        startScale: panRef.current.scale,
      });
      elem.addEventListener("wheel", panzoom.zoomWithWheel);
      setPan(panzoom);
    }
  };

  const destroyPan = () => {
    const elem = document.getElementById("img-viewer-container");
    if (pan && elem) {
      elem.removeEventListener("wheel", pan.zoomWithWheel);
      elem.style.cursor = "crosshair";
      panRef.current.x = pan.getPan().x;
      panRef.current.y = pan.getPan().y;
      panRef.current.scale = pan.getScale();
      pan.destroy();
      setPan(undefined);
    }
  };

  function getOffsetXY(element) {
    const style = window.getComputedStyle(element);
    const matrix = new DOMMatrixReadOnly(style.transform);
    const rect = element.getBoundingClientRect();
    const scale = matrix.m11;
    return {
      x: (rect.x - 10) / scale,
      y: (rect.y - 10) / scale,
      scale,
      width: rect.width,
      height: rect.height,
    };
  }

  const handleMove = (event, key) => {
    if (draw || deleteMode) return;
    const container = document.getElementById("img-viewer");
    const viewer = document.getElementById("img-viewer-container");
    const elem = document.getElementById(key);
    const img = document.getElementById("img");

    if (!viewer || !elem || !img || !container) {
      console.log("Nothing loaded????");
      return;
    }
    const rect = getOffsetXY(viewer);
    const elemRect = elem.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    //0. init values
    const marginOffsetX = containerRect.left;
    const marginOffsetY = containerRect.top;

    //1. get where mouse started
    const mouseStartX =
      (event.clientX - marginOffsetX - (elemRect.left - marginOffsetX)) /
      rect.scale;
    const mouseStartY =
      (event.clientY - marginOffsetY - (elemRect.top - marginOffsetY)) /
      rect.scale;

    //2. I like to move it move it
    const moveTo = (pageX, pageY) => {
      const targetX = (pageX - marginOffsetX) / rect.scale - mouseStartX;
      const targetY = (pageY - marginOffsetY) / rect.scale - mouseStartY;
      const { x, y } = clamp({
        targetX: targetX - rect.x,
        targetY: targetY - rect.y,
      });
      elem.style.left = Math.floor(x) + "px";
      elem.style.top = Math.floor(y) + "px";
    };

    const onMouseMove = (event) => {
      moveTo(event.clientX, event.clientY);
    };

    //constrain values to bounding box
    const clamp = ({ targetX, targetY }) => {
      let x = targetX;
      let y = targetY;

      if (x < 0) x = 0;
      if (y < 0) y = 0;
      if (x > img.naturalWidth - elemRect.width / rect.scale)
        x = Math.floor(img.naturalWidth - elemRect.width / rect.scale);
      if (y > img.naturalHeight - elemRect.height / rect.scale)
        y = Math.floor(img.naturalHeight - elemRect.height / rect.scale);

      return { x, y };
    };

    document.addEventListener("mousemove", onMouseMove);

    document.onmouseup = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.onmouseup = null;
      const nextElement = {
        x: parseInt(elem.style.left),
        y: parseInt(elem.style.top),
        w: parseInt(elem.style.width),
        h: parseInt(elem.style.height),
        key,
      };

      //ignore empty draws and commit data
      if (
        nextElement.w !== 0 &&
        nextElement.h !== 0 &&
        !isNaN(nextElement.w) &&
        !isNaN(nextElement.h)
      ) {
        setBoundingBoxes((els) =>
          els.map((el) => {
            if (el.key === key) {
              return nextElement;
            }
            return el;
          }),
        );
      }
    };
  };

  const handleResize = (event, key) => {
    if (deleteMode) return;
    const container = document.getElementById("img-viewer");
    const viewer = document.getElementById("img-viewer-container");
    const elem = document.getElementById(key);
    const img = document.getElementById("img");

    if (!viewer || !elem || !img || !container) {
      console.log("Nothing loaded????");
      return;
    }

    //make box viewable
    if (draw) {
      elem.style.display = "block";
    }

    const rect = getOffsetXY(viewer);
    const elemRect = elem.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    //0. init values
    const marginOffsetX = containerRect.left;
    const marginOffsetY = containerRect.top;

    //1. get where mouse started
    const startX =
      (event.clientX - marginOffsetX - (elemRect.left - marginOffsetX)) /
      rect.scale;
    const startY =
      (event.clientY - marginOffsetY - (elemRect.top - marginOffsetY)) /
      rect.scale;
    const startWidth = elem.style.width ? parseInt(elem.style.width) : 0;
    const startHeight = elem.style.height ? parseInt(elem.style.height) : 0;

    //1b. set up dummy draw thing if possible
    if (draw) {
      elem.style.display = "block";
      elem.style.left = Math.floor(startX) + "px";
      elem.style.top = Math.floor(startY) + "px";
    }

    //2. I like to move it move it
    const moveTo = (pageX, pageY) => {
      const targetX =
        startWidth +
        (pageX - marginOffsetX - (elemRect.left - marginOffsetX)) / rect.scale -
        startX;
      const targetY =
        startHeight +
        (pageY - marginOffsetY - (elemRect.top - marginOffsetY)) / rect.scale -
        startY;

      elem.style.width = Math.floor(targetX) + "px";
      elem.style.height = Math.floor(targetY) + "px";
    };

    const onMouseMove = (event) => {
      moveTo(event.clientX, event.clientY);
    };

    document.addEventListener("mousemove", onMouseMove);

    document.onmouseup = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.onmouseup = null;

      const nextElement = {
        x: parseInt(elem.style.left),
        y: parseInt(elem.style.top),
        w: parseInt(elem.style.width),
        h: parseInt(elem.style.height),
        key:
          key === "dummy-draw-element"
            ? `boundary-${boundingBoxes.length}`
            : key,
      };

      //ignore empty draws and commit data
      if (
        nextElement.w !== 0 &&
        nextElement.h !== 0 &&
        !isNaN(nextElement.w) &&
        !isNaN(nextElement.h)
      ) {
        if (draw) {
          setBoundingBoxes((els) => [...els, nextElement]);
        } else {
          setBoundingBoxes((els) =>
            els.map((el) => {
              if (el.key === key) {
                return nextElement;
              }
              return el;
            }),
          );
        }
      }

      // clean up
      if (draw) {
        elem.style.left = 0 + "px";
        elem.style.top = 0 + "px";
        elem.style.width = 0 + "px";
        elem.style.height = 0 + "px";
        elem.style.display = "none";
      }
    };

    //stop bubble
    event.stopPropagation();
  };

  const handleBoxFocus = (key) => {
    if (pan || draw) return;
    const elem = document.getElementById(key);
    if (!elem) return;

    setFocusedBox(key);
    if (deleteMode) {
      if (elem.classList.contains("to-delete")) {
        commitDelete(key);
      } else {
        elem.classList.add("to-delete");
        elem.classList.remove("focused");
      }
    } else {
      elem.classList.add("focused");
      elem.classList.remove("to-delete");
    }

    //clean up
    const boxes = document.getElementsByClassName("boundary");
    for (let box of boxes) {
      if (box.id !== key) {
        box.className = "boundary";
      }
    }
  };

  const commitDelete = (key) => {
    let elements = structuredClone(boundingBoxes).filter(
      (el) => el.key !== key,
    );
    elements = elements.map((el, i) => ({ ...el, key: `boundary-${i}` }));
    setBoundingBoxes(elements);
    clearSelection();
  };

  const getBoundingBoxes = () => {
    const elems = [];
    for (let i = 0; i < boundingBoxes.length; i++) {
      const box = boundingBoxes[i];
      const key = box.key;
      elems.push(
        <div
          className="boundary"
          id={key}
          key={key}
          onMouseDown={(event) => handleMove(event, key)}
          style={{ top: box.y, left: box.x, width: box.w, height: box.h }}
          onClick={() => handleBoxFocus(key)}
        >
          {focusedBox === key && (
            <div
              className="handle"
              style={{ bottom: 0, right: 0 }}
              onMouseDown={(event) => handleResize(event, key)}
            />
          )}
        </div>,
      );
    }
    return elems;
  };

  const clearSelection = () => {
    setFocusedBox("");
    const boxes = document.getElementsByClassName("boundary");
    for (let box of boxes) {
      box.className = "boundary";
    }
  };

  const toggleDraw = () => {
    if (!draw) {
      clearSelection();
      if (pan) {
        destroyPan();
      }
    }
    setDraw(!draw);
  };

  const handleDraw = (event, key) => {
    if (draw) {
      handleResize(event, key);
    }
  };

  const validateData = (entries) => {
    const keys = ["x", "y", "w", "h"];
    for (const entry of entries) {
      for (const key of keys) {
        if (!entry.hasOwnProperty(key)) {
          throw new ValidationError(
            `Error: Missing Key "${key}" in ${JSON.stringify(entry)}`,
          );
        }
      }
    }
  };

  const handleImport = (e) => {
    e.preventDefault();
    setImportError("");
    const form = e.target;
    const formData = new FormData(form);
    const boundaryDataRaw = Object.fromEntries(formData.entries())[
      "boundaryImport"
    ];
    if (!boundaryDataRaw) return;
    try {
      const boundaryData = JSON.parse(boundaryDataRaw);
      validateData(boundaryData);
      setBoundingBoxes(
        boundaryData.map((el, i) => ({ ...el, key: `boundary-${i}` })),
      );
      setImportFormData({ boundaryImport: "" });
    } catch (e) {
      setImportError(e.message);
    }
  };

  const handleExport = () => {
    let data = structuredClone(boundingBoxes);
    data = data.map((el) => {
      delete el.key;
      return el;
    });
    setExportData(JSON.stringify(data));
  };

  const handleClipboard = () => {
    if (exportData) navigator.clipboard.writeText(exportData);
  };

  const toggleDelete = () => {
    if (deleteMode) {
      clearSelection();
    }
    setDeleteMode(!deleteMode);
  };

  return (
    <div>
      {!file && (
        <div>
          <label id="drop-zone">
            Drop images here, or click to upload.
            <input
              type="file"
              id="file-input"
              accept="image/*"
              onChange={(e) => setFile(e.target.files[0])}
            />
          </label>
        </div>
      )}
      {file && (
        <div id="main-container">
          <div id="img-viewer">
            <div
              id="img-viewer-container"
              onMouseDown={(event) => handleDraw(event, "dummy-draw-element")}
            >
              <div id="dummy-draw-element"></div>
              {getBoundingBoxes()}
              <img id="img" src={URL.createObjectURL(file)} draggable="false" />
            </div>
          </div>
          <div id="controls">
            <form className="form-container" onSubmit={handleImport}>
              <label htmlFor="boundaryImport">Import Boundary Data:</label>
              <textarea
                id="boundaryImport"
                name="boundaryImport"
                rows={5}
                value={importFormData.boundaryImport}
                onChange={(e) =>
                  setImportFormData({
                    ...importFormData,
                    boundaryImport: e.target.value,
                  })
                }
              />
              {importError && <div className="error">{importError}</div>}
              <button type="submit">SUBMIT</button>
            </form>
            <div className="form-container">
              <label htmlFor="boundaryExport">Export Boundary Data:</label>
              <textarea
                id="boundaryExport"
                name="boundaryExport"
                rows={5}
                value={exportData}
                readOnly
              />
              <button onClick={handleClipboard}>COPY TO CLIPBOARD</button>
            </div>
            <div id="buttons">
              <div>
                <button onClick={handlePan} disabled={draw}>
                  {pan ? "Disable Pan" : "Enable Pan"}
                </button>
                <button onClick={clearSelection} disabled={draw || pan}>
                  Clear Box Selection
                </button>
              </div>
              <div>
                <button onClick={toggleDraw} disabled={deleteMode || pan}>
                  {draw ? "End" : "Start"} Draw
                </button>
                <button onClick={toggleDelete} disabled={draw || pan}>
                  {deleteMode ? "Disable" : "Enable"} Delete Mode
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

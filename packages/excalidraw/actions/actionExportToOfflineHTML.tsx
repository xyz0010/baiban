import { register } from "./register";
import { exportToSvg } from "../scene/export";
import { fileSave } from "../data/filesystem";
import { t } from "../i18n";
import { getNonDeletedElements, CaptureUpdateAction } from "@excalidraw/element";
import { AppState } from "../types";

export const actionExportToOfflineHTML = register({
  name: "exportToOfflineHTML",
  label: "Export to Offline HTML", 
  trackEvent: { category: "export", action: "exportToOfflineHTML" },
  perform: async (elements, appState, _, app) => {
    try {
      const exportedElements = getNonDeletedElements(elements);
      
      const svg = await exportToSvg(
        exportedElements,
        {
          exportBackground: appState.exportBackground,
          exportWithDarkMode: appState.exportWithDarkMode,
          viewBackgroundColor: appState.viewBackgroundColor,
          exportPadding: 10,
          exportScale: appState.exportScale,
          exportEmbedScene: false, // No need to embed scene json for visual only
        },
        app.files,
      );

      // Serialize SVG to string
      const svgString = svg.outerHTML;

      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Excalidraw Offline Preview</title>
    <style>
        body {
            margin: 0;
            overflow: hidden;
            background-color: ${appState.viewBackgroundColor};
            font-family: sans-serif;
        }
        #container {
            width: 100vw;
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: grab;
            overflow: hidden;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
        }
        #content {
            transform-origin: center center;
            transition: transform 0.05s ease-out;
        }
        #content svg {
            max-width: none;
            max-height: none;
            display: block;
        }
        .controls {
            position: fixed;
            bottom: 20px;
            right: 20px;
            display: flex;
            gap: 10px;
            z-index: 100;
        }
        button {
            padding: 8px 12px;
            background: #fff;
            border: 1px solid #ccc;
            border-radius: 4px;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        button:hover {
            background: #f0f0f0;
        }
    </style>
</head>
<body>
    <div id="container">
        <div id="content">
            ${svgString}
        </div>
    </div>
    
    <script>
        const container = document.getElementById('container');
        const content = document.getElementById('content');
        
        let scale = 1;
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let translateX = 0;
        let translateY = 0;

        function updateTransform() {
            content.style.transform = \`translate(\${translateX}px, \${translateY}px) scale(\${scale})\`;
        }

        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            // Zoom centered at mouse pointer
            const rect = container.getBoundingClientRect();
            const cx = rect.width / 2;
            const cy = rect.height / 2;
            
            // Mouse position relative to the container
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            
            // Vector from center to mouse
            const vx = mx - cx;
            const vy = my - cy;
            
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            
            // Update translation to keep the point under mouse stationary
            // NewTranslate = MouseVector - (MouseVector - OldTranslate) * Delta
            translateX = vx - (vx - translateX) * delta;
            translateY = vy - (vy - translateY) * delta;
            
            scale *= delta;
            updateTransform();
        }, { passive: false });

        container.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX - translateX;
            startY = e.clientY - translateY;
            container.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            translateX = e.clientX - startX;
            translateY = e.clientY - startY;
            updateTransform();
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
            container.style.cursor = 'grab';
        });

        window.addEventListener('mouseleave', () => {
            isDragging = false;
            container.style.cursor = 'grab';
        });
        
        // Touch support
        let lastTouchDistance = 0;
        
        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                isDragging = true;
                startX = e.touches[0].clientX - translateX;
                startY = e.touches[0].clientY - translateY;
            } else if (e.touches.length === 2) {
                lastTouchDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
            }
        });

        container.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && isDragging) {
                translateX = e.touches[0].clientX - startX;
                translateY = e.touches[0].clientY - startY;
                updateTransform();
            } else if (e.touches.length === 2) {
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const delta = dist / lastTouchDistance;
                scale *= delta;
                lastTouchDistance = dist;
                updateTransform();
            }
        }, { passive: false });

        container.addEventListener('touchend', () => {
            isDragging = false;
        });

    </script>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: "text/html" });
      fileSave(blob, {
        name: appState.name || "excalidraw-preview",
        extension: "html",
        description: "Export to Offline HTML",
      });

    } catch (error) {
      console.error(error);
    }
    return {
      commitToHistory: false,
      appState,
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

/**
 * Halo — Screen Capture Module
 * Full-resolution screenshot via Electron desktopCapturer.
 */

const { desktopCapturer, screen } = require('electron');

/**
 * Capture a screenshot of the primary display.
 * @returns {Promise<string|null>} Base64 data URL of the screenshot, or null on failure.
 */
async function captureScreen() {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height },
    });

    if (sources.length === 0) {
      console.warn('No screen sources available for capture.');
      return null;
    }

    // Use the primary screen source
    const primarySource = sources[0];
    return primarySource.thumbnail.toDataURL('image/png');
  } catch (err) {
    console.error('Screen capture failed:', err);
    return null;
  }
}

/**
 * Capture and return as a Buffer (PNG).
 * @returns {Promise<Buffer|null>}
 */
async function captureScreenBuffer() {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height },
    });

    if (sources.length === 0) return null;

    return sources[0].thumbnail.toPNG();
  } catch (err) {
    console.error('Screen capture (buffer) failed:', err);
    return null;
  }
}

module.exports = {
  captureScreen,
  captureScreenBuffer,
};

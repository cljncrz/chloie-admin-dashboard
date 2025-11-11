/**
 * A collection of utility functions for working with Chart.js in this application.
 */

/**
 * A global cache for Chart.js instances to prevent memory leaks and allow for updates.
 * @type {Object.<string, Chart>}
 */
window.activeCharts = window.activeCharts || {};

/**
 * Retrieves a CSS variable value from the root element.
 * @param {string} varName - The name of the CSS variable (e.g., '--color-primary').
 * @returns {string} The value of the CSS variable.
 */
const getCssVar = (varName) => {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
};

/**
 * Renders or updates a Chart.js chart in a given canvas element.
 * It destroys any existing chart on the canvas before creating a new one.
 * @param {string} canvasId - The ID of the canvas element.
 * @param {object} chartConfig - The configuration object for the new chart.
 */
const renderChart = (canvasId, chartConfig) => {
    const ctx = document.getElementById(canvasId);
    if (!ctx) {
        console.error(`Canvas with ID "${canvasId}" not found.`);
        return;
    }

    // Destroy the existing chart instance if it exists to prevent conflicts and memory leaks
    if (window.activeCharts[canvasId]) {
        window.activeCharts[canvasId].destroy();
    }

    // Create the new chart and store it in the global cache
    window.activeCharts[canvasId] = new Chart(ctx, chartConfig);
};
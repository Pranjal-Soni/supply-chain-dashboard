console.log("Dashboard JS loaded");

const dataPath = "supply_chain_data.csv"; 

// --- D3 Setup ---
const defaultMargin = {top: 20, right: 30, bottom: 60, left: 70};

// --- Helper Functions ---
const formatNumber = d3.format(",.0f"); 
const formatCurrency = d3.format("$,.2f");
const formatPercent = d3.format(".1%"); 

// Tooltip Handlers (Reusable)
function createTooltip(tooltipId) {
    return d3.select(tooltipId);
}

function showTooltip(event, tooltip, htmlContent) {
    tooltip.transition()
        .duration(100)
        .style("opacity", 1);
    tooltip.html(htmlContent)
        .style("left", (event.pageX + 15) + "px")
        .style("top", (event.pageY - 28) + "px");
}

function moveTooltip(event, tooltip) {
     tooltip.style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 28) + "px");
}

function hideTooltip(tooltip) {
    tooltip.transition()
        .duration(200)
        .style("opacity", 0);
}



d3.csv(dataPath).then(data => {
    console.log("Raw data loaded:", data.length, "rows");
    if (data.length === 0) {
        console.error("CSV file loaded successfully, but it contains no data rows.");
        alert("Warning: The CSV file appears to be empty.");
        return;
    }
    console.log("Sample raw row:", data[0]);


    data.forEach(d => {
        d.Price = +d.Price;
        d.Availability = +d.Availability;
        d['Number of products sold'] = +d['Number of products sold']; // Use brackets for spaces
        d['Revenue generated'] = +d['Revenue generated'];
        d['Stock levels'] = +d['Stock levels'];
        d['Lead times'] = +d['Lead times']; // Customer lead time
        d['Order quantities'] = +d['Order quantities'];
        d['Shipping times'] = +d['Shipping times'];
        d['Shipping costs'] = +d['Shipping costs'];
        d['Lead time'] = +d['Lead time']; // Supplier lead time (assumption)
        d['Production volumes'] = +d['Production volumes'];
        d['Manufacturing lead time'] = +d['Manufacturing lead time'];
        d['Manufacturing costs'] = +d['Manufacturing costs'];
        d['Defect rates'] = +d['Defect rates']; // Assuming this is a rate like 0.05 for 5%
        d.Costs = +d.Costs; // Transportation costs (assumption)

        // Clean up potential NaN values after conversion (replace with 0 or handle appropriately)
        Object.keys(d).forEach(key => {
             if (!isNaN(d[key]) && d[key] === null) { // Check if parsing resulted in null explicitly
                 d[key] = 0; // Or handle as missing data
             } else if (isNaN(d[key]) && typeof d[key] === 'number') { // Check if a numeric conversion resulted in NaN
                 console.warn(`NaN found in column "${key}" for row:`, d);
                 d[key] = 0; // Replace NaN with 0, or filter out row later
             }
         });
    });
    console.log("Sample parsed row:", data[0]);
    console.log("Data parsing complete.");


    calculateKPIs(data);

    // --- Create Charts ---
    createRevenueChart(data, "#revenue-chart", "#tooltip-revenue");
    createDefectChart(data, "#defect-chart", "#tooltip-defect");
    createStockChart(data, "#stock-chart", "#tooltip-stock");
    createShippingBoxPlot(data, "#shipping-cost-chart", "#tooltip-shipping");
    createLeadTimeHistogram(data, "#leadtime-hist-chart", "#tooltip-leadtime");
    createTransportDonut(data, "#transport-donut-chart", "#tooltip-transport");
    // --- Call functions for other charts here ---


}).catch(error => {
    console.error('Error loading or parsing data:', error);
    alert(`Failed to load or parse data from "${dataPath}". Check console (F12) for details.`);
});


// --- KPI Calculation Function ---
function calculateKPIs(data) {
    console.log("Calculating KPIs...");
    const totalRevenue = d3.sum(data, d => d['Revenue generated']);
    const avgShippingCost = d3.mean(data, d => d['Shipping costs']);
    const avgDefectRate = d3.mean(data, d => d['Defect rates']); 
    const avgLeadTime = d3.mean(data, d => d['Lead times']);

    // Update HTML elements
    d3.select("#total-revenue").text(formatCurrency(totalRevenue));
    d3.select("#avg-shipping-cost").text(formatCurrency(avgShippingCost));
    d3.select("#avg-defect-rate").text(formatPercent(avgDefectRate));
    d3.select("#avg-lead-time").text(`${formatNumber(avgLeadTime)} days`); 
    console.log("KPIs calculated and displayed.");
}


// --- Charting Functions ---

// 1. Revenue by Product Type (Bar Chart)
function createRevenueChart(data, containerSelector, tooltipSelector) {
    console.log("Creating Revenue Chart...");
    const container = d3.select(containerSelector);
    const tooltip = createTooltip(tooltipSelector);
    if (container.node() === null) { console.error(`Container ${containerSelector} not found.`); return; }
    const bounds = container.node().getBoundingClientRect();
    const width = bounds.width - defaultMargin.left - defaultMargin.right;
    const height = bounds.height - defaultMargin.top - defaultMargin.bottom;

    // Aggregate data
    const revenueByProduct = d3.rollup(data, v => d3.sum(v, d => d['Revenue generated']), d => d['Product type']);
    const chartData = Array.from(revenueByProduct, ([key, value]) => ({ key: key || "Unknown", value }))
                           .sort((a, b) => d3.descending(a.value, b.value)); // Sort descending

    if (chartData.length === 0) { console.warn("No data for revenue chart."); return; }
    console.log("Revenue Chart Data:", chartData);

    const svg = container.append("svg")
        .attr("width", bounds.width)
        .attr("height", bounds.height)
      .append("g")
        .attr("transform", `translate(${defaultMargin.left},${defaultMargin.top})`);

    // Scales
    const x = d3.scaleBand()
        .domain(chartData.map(d => d.key))
        .range([0, width])
        .padding(0.2);

    const y = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d.value)]).nice()
        .range([height, 0]);

    // Axes
    const xAxis = d3.axisBottom(x);
    const yAxis = d3.axisLeft(y).ticks(5).tickFormat(d3.format("~s"));

    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis)
        .selectAll("text")
          .attr("transform", "rotate(-45)")
          .style("text-anchor", "end")
          .attr("dx", "-.8em")
          .attr("dy", ".15em");

    svg.append("g")
        .attr("class", "y-axis")
        .call(yAxis);

    // Y Axis Label
    svg.append("text")
       .attr("transform", "rotate(-90)")
       .attr("y", 0 - defaultMargin.left)
       .attr("x", 0 - (height / 2))
       .attr("dy", "1em")
       .style("text-anchor", "middle")
       .style("font-size", "12px")
       .text("Total Revenue");


    // Bars
    svg.selectAll(".bar")
        .data(chartData)
        .join("rect")
          .attr("class", "bar")
          .attr("x", d => x(d.key))
          .attr("y", d => y(0))
          .attr("width", x.bandwidth())
          .attr("height", d => 0)
          .on("mouseover", (event, d) => {
              const tooltipHtml = `<strong>${d.key}</strong><br>Revenue: ${formatCurrency(d.value)}`;
              showTooltip(event, tooltip, tooltipHtml);
          })
          .on("mousemove", (event) => moveTooltip(event, tooltip))
          .on("mouseleave", () => hideTooltip(tooltip))
          // Add transition
          .transition()
          .duration(800)
          .attr("y", d => y(d.value))
          .attr("height", d => height - y(d.value))
          .delay((d, i) => i * 50); 

    console.log("Revenue Chart created.");
}


// 2. Defect Rate by Supplier (Lollipop Chart)
function createDefectChart(data, containerSelector, tooltipSelector) {
    console.log("Creating Defect Rate Chart...");
    const container = d3.select(containerSelector);
    const tooltip = createTooltip(tooltipSelector);
     if (container.node() === null) { console.error(`Container ${containerSelector} not found.`); return; }
    const bounds = container.node().getBoundingClientRect();
    const width = bounds.width - defaultMargin.left - defaultMargin.right;
    const height = bounds.height - defaultMargin.top - defaultMargin.bottom;

    // Aggregate data: Average defect rate per supplier
    const defectBySupplier = d3.rollup(data,
        v => d3.mean(v, d => d['Defect rates']), // Calculate mean defect rate
        d => d['Supplier name']
    );
    const chartData = Array.from(defectBySupplier, ([key, value]) => ({ key: key || "Unknown", value }))
                           .filter(d => !isNaN(d.value) && d.value !== null) // Ensure value is valid
                           .sort((a, b) => d3.ascending(a.value, b.value)); // Sort ascending

    if (chartData.length === 0) { console.warn("No valid data for defect chart."); return; }
     console.log("Defect Chart Data:", chartData);

    const svg = container.append("svg")
        .attr("width", bounds.width)
        .attr("height", bounds.height)
      .append("g")
        .attr("transform", `translate(${defaultMargin.left},${defaultMargin.top})`);

    // Scales
    const x = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d.value)]).nice()
        .range([0, width]);

    const y = d3.scaleBand()
        .domain(chartData.map(d => d.key))
        .range([0, height])
        .padding(1); // Padding for lollipop style

    // Axes
    const xAxis = d3.axisBottom(x).ticks(5).tickFormat(formatPercent);
    const yAxis = d3.axisLeft(y);

    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis);

    svg.append("g")
        .attr("class", "y-axis")
        .call(yAxis);

    // X Axis Label
     svg.append("text")
        .attr("transform", `translate(${width/2}, ${height + defaultMargin.bottom - 20})`)
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .text("Average Defect Rate");

    // Lollipops
    const lollipop = svg.selectAll(".lollipop")
        .data(chartData)
        .join("g")
          .attr("class", "lollipop");

    // Lines
    lollipop.append("line")
        .attr("x1", x(0)) // Start from 0
        .attr("x2", x(0)) // Start from 0
        .attr("y1", d => y(d.key))
        .attr("y2", d => y(d.key))
        .attr("stroke", "grey")
        // Add transition
        .transition()
        .duration(800)
        .attr("x2", d => x(d.value))
        .delay((d, i) => i * 30);

    // Circles
    lollipop.append("circle")
        .attr("cx", x(0)) // Start from 0
        .attr("cy", d => y(d.key))
        .attr("r", 0) // Start animation from radius 0
        .on("mouseover", (event, d) => {
            const tooltipHtml = `<strong>${d.key}</strong><br>Avg. Defect Rate: ${formatPercent(d.value)}`;
            showTooltip(event, tooltip, tooltipHtml);
        })
        .on("mousemove", (event) => moveTooltip(event, tooltip))
        .on("mouseleave", () => hideTooltip(tooltip))
         // Add transition
         .transition()
         .duration(800)
         .attr("cx", d => x(d.value))
         .attr("r", 5) // Final radius
         .delay((d, i) => i * 30);

     console.log("Defect Chart created.");
}

// 3. Stock Level vs. Sales (Scatter Plot)
function createStockChart(data, containerSelector, tooltipSelector) {
     console.log("Creating Stock vs Sales Chart...");
     const container = d3.select(containerSelector);
     const tooltip = createTooltip(tooltipSelector);
      if (container.node() === null) { console.error(`Container ${containerSelector} not found.`); return; }
     const bounds = container.node().getBoundingClientRect();
     const width = bounds.width - defaultMargin.left - defaultMargin.right;
     const height = bounds.height - defaultMargin.top - defaultMargin.bottom;

     // Filter data to ensure valid numerical values for axes
     const chartData = data.filter(d =>
         d['Stock levels'] !== null && !isNaN(d['Stock levels']) &&
         d['Number of products sold'] !== null && !isNaN(d['Number of products sold'])
     );

     if (chartData.length === 0) { console.warn("No valid data for stock vs sales chart."); return; }
     console.log("Stock Chart Data points:", chartData.length);


     const svg = container.append("svg")
         .attr("width", bounds.width)
         .attr("height", bounds.height)
       .append("g")
         .attr("transform", `translate(${defaultMargin.left},${defaultMargin.top})`);

     // Scales
     const x = d3.scaleLinear()
         .domain([0, d3.max(chartData, d => d['Stock levels'])]).nice()
         .range([0, width]);

     const y = d3.scaleLinear()
         .domain([0, d3.max(chartData, d => d['Number of products sold'])]).nice()
         .range([height, 0]);

    // Optional: Color scale by Product type
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10)
                         .domain(d3.map(data, d => d['Product type']));


     // Axes
     const xAxis = d3.axisBottom(x).ticks(5);
     const yAxis = d3.axisLeft(y).ticks(5);

     svg.append("g")
         .attr("class", "x-axis")
         .attr("transform", `translate(0,${height})`)
         .call(xAxis);

     svg.append("g")
         .attr("class", "y-axis")
         .call(yAxis);

     // Axis Labels
      svg.append("text") // X Axis Label
         .attr("transform", `translate(${width/2}, ${height + defaultMargin.bottom - 20})`)
         .style("text-anchor", "middle")
         .style("font-size", "12px")
         .text("Stock Levels");

      svg.append("text") // Y Axis Label
         .attr("transform", "rotate(-90)")
         .attr("y", 0 - defaultMargin.left)
         .attr("x", 0 - (height / 2))
         .attr("dy", "1em")
         .style("text-anchor", "middle")
         .style("font-size", "12px")
         .text("Number of Products Sold");


     // Dots
     svg.selectAll(".dot")
         .data(chartData)
         .join("circle")
           .attr("class", "dot")
           .attr("cx", d => x(d['Stock levels']))
           .attr("cy", d => y(d['Number of products sold']))
           .attr("r", 0) // Start animation from radius 0
           .style("fill", d => colorScale(d['Product type'])) // Color by product type
           .on("mouseover", (event, d) => {
               const tooltipHtml = `<strong>SKU:</strong> ${d.SKU || 'N/A'}<br>` +
                                 `<strong>Product Type:</strong> ${d['Product type']}<br>` +
                                 `<strong>Stock:</strong> ${formatNumber(d['Stock levels'])}<br>` +
                                 `<strong>Sold:</strong> ${formatNumber(d['Number of products sold'])}`;
               showTooltip(event, tooltip, tooltipHtml);
           })
          .on("mousemove", (event) => moveTooltip(event, tooltip))
          .on("mouseleave", () => hideTooltip(tooltip))
          // Add transition
          .transition()
          .duration(600)
          .attr("r", 4) // Final radius
          .delay((d, i) => Math.random() * 500); // Random delay for effect


      console.log("Stock vs Sales Chart created.");
}

function createShippingBoxPlot(data, containerSelector, tooltipSelector) {
    console.log("Creating Shipping Cost Box Plot...");
    const container = d3.select(containerSelector);
    const tooltip = createTooltip(tooltipSelector);
    if (container.node() === null) { console.error(`Container ${containerSelector} not found.`); return; }
    const bounds = container.node().getBoundingClientRect();
   
    const margin = {top: 20, right: 30, bottom: 80, left: 60};
    const width = bounds.width - margin.left - margin.right;
    const height = bounds.height - margin.top - margin.bottom;

    
    const filteredData = data.filter(d =>
        d['Shipping costs'] !== null && !isNaN(d['Shipping costs']) &&
        d['Shipping carriers'] && d['Shipping carriers'].trim() !== ""
    );

    
    const costsByCarrier = d3.group(filteredData, d => d['Shipping carriers']);

    
    const statsByCarrier = [];
    costsByCarrier.forEach((costs, carrier) => {
        const costValues = costs.map(d => d['Shipping costs']).sort(d3.ascending);
        const q1 = d3.quantile(costValues, 0.25);
        const median = d3.quantile(costValues, 0.5);
        const q3 = d3.quantile(costValues, 0.75);
        const iqr = q3 - q1;
        // Define whiskers typically as 1.5 * IQR from the box
        const lowerWhisker = Math.max(d3.min(costValues), q1 - 1.5 * iqr);
        const upperWhisker = Math.min(d3.max(costValues), q3 + 1.5 * iqr);



        if (q1 !== undefined && median !== undefined && q3 !== undefined) {
             statsByCarrier.push({
                 key: carrier,
                 q1: q1,
                 median: median,
                 q3: q3,
                 lowerWhisker: lowerWhisker,
                 upperWhisker: upperWhisker
             });
        } else {
            console.warn(`Could not calculate stats for carrier: ${carrier}`);
        }
    });

    statsByCarrier.sort((a, b) => d3.ascending(a.median, b.median)); // Sort by median cost

    if (statsByCarrier.length === 0) { console.warn("No valid data for shipping cost box plot."); return; }
    console.log("Box Plot Stats:", statsByCarrier);

    const svg = container.append("svg")
        .attr("width", bounds.width)
        .attr("height", bounds.height)
      .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scaleBand()
        .domain(statsByCarrier.map(d => d.key))
        .range([0, width])
        .paddingInner(0.1)
        .paddingOuter(0.2);

    const y = d3.scaleLinear()
        .domain([0, d3.max(statsByCarrier, d => d.upperWhisker) * 1.05]).nice() // Extend slightly beyond max whisker
        .range([height, 0]);

    const boxWidth = x.bandwidth() * 0.6; // Width of the boxes

    // Axes
    const xAxis = d3.axisBottom(x);
    const yAxis = d3.axisLeft(y).ticks(6).tickFormat(d3.format("$,.0f")); // Format as currency

    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis)
        .selectAll("text")
          .attr("transform", "rotate(-45)")
          .style("text-anchor", "end")
          .attr("dx", "-.8em")
          .attr("dy", ".15em");

    svg.append("g")
        .attr("class", "y-axis")
        .call(yAxis);

     // Y Axis Label
     svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .text("Shipping Cost");

    // Draw Boxplots
    const boxplotGroup = svg.selectAll(".boxplot")
        .data(statsByCarrier)
        .join("g")
          .attr("class", "boxplot")
          // Center the boxplot elements within the band
          .attr("transform", d => `translate(${x(d.key) + (x.bandwidth() / 2)}, 0)`);


    // Center vertical line (whisker)
    boxplotGroup.append("line")
        .attr("y1", d => y(d.lowerWhisker))
        .attr("y2", d => y(d.upperWhisker))
        .attr("x1", 0)
        .attr("x2", 0);

    // Box rectangle
    boxplotGroup.append("rect")
        .attr("class", "box")
        .attr("y", d => y(d.q3))
        .attr("height", d => Math.max(1, y(d.q1) - y(d.q3))) // Ensure height is at least 1px
        .attr("x", -boxWidth / 2)
        .attr("width", boxWidth);

    // Median line
    boxplotGroup.append("line")
        .attr("class", "median")
        .attr("y1", d => y(d.median))
        .attr("y2", d => y(d.median))
        .attr("x1", -boxWidth / 2)
        .attr("x2", boxWidth / 2);

    // Optional: Add top/bottom whisker lines (caps)
    boxplotGroup.append("line") // Bottom whisker cap
        .attr("y1", d => y(d.lowerWhisker))
        .attr("y2", d => y(d.lowerWhisker))
        .attr("x1", -boxWidth / 4)
        .attr("x2", boxWidth / 4);
     boxplotGroup.append("line") // Top whisker cap
        .attr("y1", d => y(d.upperWhisker))
        .attr("y2", d => y(d.upperWhisker))
        .attr("x1", -boxWidth / 4)
        .attr("x2", boxWidth / 4);

     // Add invisible rect for easier tooltip triggering
     boxplotGroup.append("rect")
        .attr("y", d => y(d.upperWhisker))
        .attr("height", d => y(d.lowerWhisker) - y(d.upperWhisker))
        .attr("x", -boxWidth / 2)
        .attr("width", boxWidth)
        .style("fill", "none")
        .style("pointer-events", "all") // Make invisible rect trigger events
         .on("mouseover", (event, d) => {
             const tooltipHtml = `<strong>${d.key}</strong><br>` +
                               `Median Cost: ${formatCurrency(d.median)}<br>` +
                               `Q1: ${formatCurrency(d.q1)}<br>` +
                               `Q3: ${formatCurrency(d.q3)}<br>` +
                               `IQR: ${formatCurrency(d.q3 - d.q1)}<br>`+
                               `Whisker Range: ${formatCurrency(d.lowerWhisker)} - ${formatCurrency(d.upperWhisker)}`;
             showTooltip(event, tooltip, tooltipHtml);
         })
         .on("mousemove", (event) => moveTooltip(event, tooltip))
         .on("mouseleave", () => hideTooltip(tooltip));

    console.log("Shipping Cost Box Plot created.");
}


// 5. Customer Lead Time Distribution (Histogram)
function createLeadTimeHistogram(data, containerSelector, tooltipSelector) {
    console.log("Creating Lead Time Histogram...");
    const container = d3.select(containerSelector);
    const tooltip = createTooltip(tooltipSelector);
    if (container.node() === null) { console.error(`Container ${containerSelector} not found.`); return; }
    const bounds = container.node().getBoundingClientRect();
    const margin = {top: 20, right: 30, bottom: 50, left: 60}; // Adjusted margins
    const width = bounds.width - margin.left - margin.right;
    const height = bounds.height - margin.top - margin.bottom;

    // Filter data for valid numeric lead times
    const leadTimes = data.map(d => d['Lead times']).filter(d => d !== null && !isNaN(d));

    if (leadTimes.length === 0) { console.warn("No valid data for lead time histogram."); return; }
    console.log("Lead Time data points:", leadTimes.length);


    const svg = container.append("svg")
        .attr("width", bounds.width)
        .attr("height", bounds.height)
      .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain(d3.extent(leadTimes)).nice()
        .range([0, width]);


    const histogram = d3.histogram()
        .value(d => d) 
        .domain(x.domain())
        .thresholds(12); 

    const bins = histogram(leadTimes);
     if (bins.length === 0) { console.warn("Histogram resulted in zero bins."); return; }
    console.log("Histogram Bins:", bins);

    // Y scale based on bin frequencies
    const y = d3.scaleLinear()
        .domain([0, d3.max(bins, d => d.length)]).nice()
        .range([height, 0]);

    // Axes
    const xAxis = d3.axisBottom(x);
    const yAxis = d3.axisLeft(y).ticks(5);

    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis);

    svg.append("g")
        .attr("class", "y-axis")
        .call(yAxis);

     // Axis Labels
      svg.append("text")
         .attr("transform", `translate(${width/2}, ${height + margin.bottom - 10})`)
         .style("text-anchor", "middle")
         .style("font-size", "12px")
         .text("Customer Lead Time (days)");

      svg.append("text") 
         .attr("transform", "rotate(-90)")
         .attr("y", 0 - margin.left)
         .attr("x", 0 - (height / 2))
         .attr("dy", "1em")
         .style("text-anchor", "middle")
         .style("font-size", "12px")
         .text("Number of Orders");

    // Bars
    svg.selectAll(".hist-bar")
        .data(bins)
        .join("rect")
          .attr("class", "hist-bar")
          .attr("x", d => x(d.x0) + 1) 
          .attr("y", d => y(0))
          .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1)) 
          .attr("height", 0)
          .on("mouseover", (event, d) => {
              const tooltipHtml = `<strong>Range:</strong> ${formatNumber(d.x0)} - ${formatNumber(d.x1)} days<br>` +
                                 `<strong>Count:</strong> ${formatNumber(d.length)} orders`;
              showTooltip(event, tooltip, tooltipHtml);
          })
          .on("mousemove", (event) => moveTooltip(event, tooltip))
          .on("mouseleave", () => hideTooltip(tooltip))
          // Add transition
          .transition()
          .duration(600)
          .attr("y", d => y(d.length))
          .attr("height", d => height - y(d.length))
          .delay((d, i) => i * 20);

     console.log("Lead Time Histogram created.");
}



// 6. Transportation Modes Usage (Donut Chart) 
function createTransportDonut(data, containerSelector, tooltipSelector) {
    console.log("Creating Transportation Donut Chart...");
    const container = d3.select(containerSelector);
    const tooltip = createTooltip(tooltipSelector);
    if (container.node() === null) { console.error(`Container ${containerSelector} not found.`); return; }
    const bounds = container.node().getBoundingClientRect();
    const size = Math.min(bounds.width, bounds.height);
    const radius = size / 2 * 0.8;
    // Keep inner radius - adjust if text overlaps too much
    const innerRadius = radius * 0.6;

    const margin = {
        top: (bounds.height - size) / 2,
        right: (bounds.width - size) / 2,
        bottom: (bounds.height - size) / 2,
        left: (bounds.width - size) / 2
    };

    // Aggregate data
    const transportCounts = d3.rollup(data, v => v.length, d => d['Transportation modes']);
    const chartData = Array.from(transportCounts, ([key, value]) => ({ key: key || "Unknown", value }))
                           .sort((a, b) => d3.descending(a.value, b.value));

    if (chartData.length === 0) { console.warn("No data for transport modes donut chart."); return; }
    console.log("Transport Donut Chart Data:", chartData);

    // === Calculate Total Count ===
    const totalCount = d3.sum(chartData, d => d.value);
    console.log("Total Transport Count:", totalCount);

    container.select("svg").remove();

    const svg = container.append("svg")
        .attr("width", bounds.width)
        .attr("height", bounds.height)
      .append("g")
        .attr("transform", `translate(${margin.left + size / 2}, ${margin.top + size / 2})`); 

    // Color scale
    const color = d3.scaleOrdinal(d3.schemePastel1)
                    .domain(chartData.map(d => d.key));

    // Pie layout generator
    const pie = d3.pie()
        .value(d => d.value)
        .sort(null);

    // Arc generator
    const arc = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(radius);

    // Arcs
    const arcs = svg.selectAll(".donut-arc")
        .data(pie(chartData))
        .join("g")
          .attr("class", "donut-arc");

    arcs.append("path")
        .attr("d", arc)
        .attr("fill", d => color(d.data.key))
        .attr("stroke", "white")
        .style("stroke-width", "1px")
        .on("mouseover", (event, d) => {
             const percent = (d.endAngle - d.startAngle) / (2 * Math.PI);
             const tooltipHtml = `<strong>${d.data.key}</strong><br>` +
                                `Count: ${formatNumber(d.data.value)}<br>` +
                                `Share: ${formatPercent(percent)}`;
             showTooltip(event, tooltip, tooltipHtml);
        })
        .on("mousemove", (event) => moveTooltip(event, tooltip))
        .on("mouseleave", (event, d) => {
             hideTooltip(tooltip);
         })
         .transition()
         .duration(700)
         .attrTween("d", function(d) {
            const i = d3.interpolate({startAngle: d.startAngle, endAngle: d.startAngle}, d);
            return function(t) { return arc(i(t)); };
         });


    svg.append("text")
        .attr("class", "donut-center-text")
        .text(formatNumber(totalCount)); 

    console.log("Transport Donut Chart created.");
}

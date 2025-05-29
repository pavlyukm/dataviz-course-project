// Load the data from the local CSV file
d3.csv("data.csv").then(data => {
  console.log("Data loaded:", data);

  // Prepare the data for the tree map using d3.rollup
  const rollupData = d3.rollup(
    data,
    v => {
      const maleCount = v.filter(d => d.Sex === 'Ч').length;
      const femaleCount = v.filter(d => d.Sex === 'Ж').length;
      return { total: v.length, maleCount, femaleCount };
    },
    d => d.Department
  );

  console.log("Rollup data:", rollupData);

  // Convert the rollup data into a hierarchical format
  const rootData = {
    name: "Departments",
    children: Array.from(rollupData, ([key, value]) => ({
      name: key,
      value: value.total,
      maleCount: value.maleCount,
      femaleCount: value.femaleCount
    }))
  };

  console.log("Root data:", rootData);

  // Create the hierarchy directly from the rollup data
  const root = d3.hierarchy(rootData)
    .sum(d => d.value)
    .sort((a, b) => b.value - a.value);

  console.log("Hierarchy root:", root);

  // Specify the chart’s dimensions
  const width = 1154;
  const height = 800;
  const legendHeight = 50;
  const paddingTop = 60; // Padding for the legend

  // Specify the color scale for sex balance
  const color = d3.scaleSequential(d3.interpolateRdYlBu)
    .domain([0, 1]); // 0 for all male, 1 for all female

  // Compute the layout
  d3.treemap()
    .tile(d3.treemapSquarify)
    .size([width, height - legendHeight - paddingTop])
    .padding(1)
    .round(true)(root);

  // Create the SVG container
  const svg = d3.select("#chart").append("svg")
      .attr("viewBox", [0, 0, width, height])
      .attr("width", width)
      .attr("height", height)
      .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;");

  if (svg.empty()) {
    console.error("SVG element not found or not appended correctly.");
    return;
  }

  // Add a legend
  const legendWidth = 200;
  const legendX = (width - legendWidth) / 2;
  const legendY = 10;

  const legend = d3.select("#legend").append("svg")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .append("g")
    .attr("transform", `translate(${legendX},${legendY})`);

  legend.append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("fill", "white")
    .attr("stroke", "black");

  // Add minimalistic legend items
  const legendItems = [
    { color: color(0), label: "All Male" },
    { color: color(0.5), label: "Balanced" },
    { color: color(1), label: "All Female" }
  ];

  legend.selectAll("rect.legend-item")
    .data(legendItems)
    .enter()
    .append("rect")
    .attr("class", "legend-item")
    .attr("x", (d, i) => i * (legendWidth / 3))
    .attr("y", 20)
    .attr("width", legendWidth / 3)
    .attr("height", 20)
    .attr("fill", d => d.color);

  legend.selectAll("text.legend-label")
    .data(legendItems)
    .enter()
    .append("text")
    .attr("class", "legend-label")
    .attr("x", (d, i) => i * (legendWidth / 3) + (legendWidth / 6))
    .attr("y", 50)
    .attr("text-anchor", "middle")
    .text(d => d.label);

  // Create a group for the treemap
  const treemapGroup = svg.append("g")
    .attr("transform", `translate(0,${legendHeight + paddingTop})`);

  // Add a cell for each leaf of the hierarchy
  const leaf = treemapGroup.selectAll("g")
    .data(root.leaves())
    .join("g")
      .attr("transform", d => `translate(${d.x0},${d.y0})`);

  // Append a tooltip
  const format = d3.format(",d");
  leaf.append("title")
      .text(d => `${d.data.name}\nTotal: ${format(d.value)}\nMale: ${d.data.maleCount}\nFemale: ${d.data.femaleCount}`);

  // Append a color rectangle
  leaf.append("rect")
      .attr("fill", d => {
        const maleRatio = d.data.maleCount / d.value;
        return color(maleRatio);
      })
      .attr("fill-opacity", 0.6)
      .attr("width", d => d.x1 - d.x0)
      .attr("height", d => d.y1 - d.y0);

  // Append multiline text
  leaf.append("text")
      .attr("class", "treemap-text")
      .attr("clip-path", d => d.clipUid)
    .selectAll("tspan")
    .data(d => [d.data.name, format(d.value)])
    .join("tspan")
      .attr("x", 3)
      .attr("y", (d, i) => `${i * 0.9 + 1.1}em`)
      .text(d => d);

  // Make the treemap zoomable without panning
  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", (event) => {
      treemapGroup.attr("transform", event.transform);
    });

  svg.call(zoom)
    .on("dblclick.zoom", null); // Disable double-click zoom to reset

}).catch(error => {
  console.error("Error loading data:", error);
});

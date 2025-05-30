// Load the data from the local CSV file
d3.csv("data.csv").then(data => {
  // Calculate total students
  const totalStudents = data.length;

  // Calculate total departments
  const totalDepartments = new Set(data.map(d => d.Department)).size;

  // Calculate total schools
  const totalSchools = new Set(data.map(d => d.UniID)).size;

  // Display the information above the legend
  const statsContainer = d3.select("#stats");
  statsContainer.append("div").text(`Total Students: ${totalStudents}`);
  statsContainer.append("div").text(`Total Departments: ${totalDepartments}`);
  statsContainer.append("div").text(`Total Schools: ${totalSchools}`);

  // Prepare the data for the treemap using d3.rollup
  const rollupData = d3.rollup(
    data,
    v => {
      const maleCount = v.filter(d => d.Sex === 'Ч').length;
      const femaleCount = v.filter(d => d.Sex === 'Ж').length;
      return { total: v.length, maleCount, femaleCount };
    },
    d => d.Department
  );

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

  // Create the hierarchy directly from the rollup data
  const root = d3.hierarchy(rootData)
    .sum(d => d.value)
    .sort((a, b) => b.value - a.value);

  // Specify the color scale for sex balance
  const color = d3.scaleSequential(d3.interpolateRdYlBu)
    .domain([0, 1]); // 0 for all male, 1 for all female

  // Specify the chart’s dimensions
  const width = document.getElementById('chart').clientWidth;
  const height = document.getElementById('chart').clientHeight;

  // Compute the layout
  d3.treemap()
    .tile(d3.treemapSquarify)
    .size([width, height])
    .padding(1)
    .round(true)(root);

  // Create the SVG container
  const svg = d3.select("#chart").append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("style", "font: 10px sans-serif;");

  // Create a group for the treemap
  const treemapGroup = svg.append("g");

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

  // Define a minimum area threshold for displaying text
  const minAreaThreshold = 2250; // Adjust this value as needed

  // Function to wrap text within a cell
  function wrapText(textElement, width, text, x, y) {
    const words = text.split(/\s+/).reverse();
    let word;
    let line = [];
    let lineNumber = 0;
    const lineHeight = 1.1; // ems
    let tspan = textElement.append("tspan").attr("x", x).attr("y", y);

    while (word = words.pop()) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > width) {
        line.pop();
        tspan.text(line.join(" "));
        line = [word];
        tspan = textElement.append("tspan")
          .attr("x", x)
          .attr("y", y)
          .attr("dy", `${++lineNumber * lineHeight}em`)
          .text(word);
      }
    }
  }

  // Append text and handle overflow based on cell area
  leaf.each(function(d) {
    const cellWidth = d.x1 - d.x0;
    const cellHeight = d.y1 - d.y0;
    const cellArea = cellWidth * cellHeight;

    if (cellArea > minAreaThreshold) {
      const textGroup = d3.select(this).append("text")
        .attr("class", "treemap-text")
        .attr("x", 3)
        .attr("y", 13);

      wrapText(textGroup, cellWidth - 6, d.data.name, 3, 13);
    }
  });

  // Add a legend
  const legendItems = [
    { color: color(0), label: "All Male" },
    { color: color(0.5), label: "Balanced" },
    { color: color(1), label: "All Female" }
  ];

  const legendContainer = d3.select("#legend-container");

  legendItems.forEach(item => {
    const legendItem = legendContainer.append("div")
      .attr("class", "legend-item");

    legendItem.append("div")
      .attr("class", "legend-color")
      .style("background-color", item.color);

    legendItem.append("div")
      .text(item.label);
  });

  // Make the treemap responsive
  window.addEventListener('resize', function() {
    const width = document.getElementById('chart').clientWidth;
    const height = document.getElementById('chart').clientHeight;

    d3.treemap()
      .size([width, height])
      .padding(1)
      .round(true)(root);

    svg.attr("width", width).attr("height", height);

    treemapGroup.selectAll("g")
      .attr("transform", d => `translate(${d.x0},${d.y0})`);

    treemapGroup.selectAll("rect")
      .attr("width", d => d.x1 - d.x0)
      .attr("height", d => d.y1 - d.y0);
  });

}).catch(error => {
  console.error("Error loading data:", error);
});

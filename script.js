d3.csv("data.csv").then(data => {
  const totalStudents = data.length;
  const totalDepartments = new Set(data.map(d => d.Department)).size;
  const totalSchools = new Set(data.map(d => d.UniID)).size;
  const totalCategories = new Set(data.map(d => d.Category)).size;
  const totalMen = data.filter(d => d.Sex === 'Ч').length;
  const totalWomen = data.filter(d => d.Sex === 'Ж').length;
  const menPercentage = (totalMen / totalStudents) * 100;
  const womenPercentage = (totalWomen / totalStudents) * 100;

  // statistics
  const statsContainer = d3.select("#stats");
  statsContainer.append("div").html(`<strong>Всього вступників:</strong> ${totalStudents}`);
  statsContainer.append("div").html(`<strong>Всього спеціальностей:</strong> ${totalDepartments}`);
  statsContainer.append("div").html(`<strong>Всього навчальних закладів:</strong> ${totalSchools}`);
  statsContainer.append("div").html(`<strong>Всього галузей знань:</strong> ${totalCategories}`);
  statsContainer.append("div").html(`<strong>Чоловіки:</strong> ${totalMen} (${menPercentage.toFixed(2)}%)`);
  statsContainer.append("div").html(`<strong>Жінки:</strong> ${totalWomen} (${womenPercentage.toFixed(2)}%)`);

  // prep data for the treemap using d3.rollup
  const rollupData = d3.rollup(
    data,
    v => {
      const maleCount = v.filter(d => d.Sex === 'Ч').length;
      const femaleCount = v.filter(d => d.Sex === 'Ж').length;
      const category = v[0].Category;
      return { total: v.length, maleCount, femaleCount, category };
    },
    d => d.Department
  );

  // structuring our data and creating hierarchy
  const rootData = {
    name: "Departments",
    children: Array.from(rollupData, ([key, value]) => ({
      name: key,
      value: value.total,
      maleCount: value.maleCount,
      femaleCount: value.femaleCount,
      category: value.category
    }))
  };

  const root = d3.hierarchy(rootData)
    .sum(d => d.value)
    .sort((a, b) => b.value - a.value);

  // color scale for sex
  const color = d3.piecewise(d3.interpolateRgb, [
  "#E8B4CB",
  "#F5F5DC",
  "#B4D4E8" // https://colorhunt.co/ 
  ]);

  // https://d3js.org/d3-scale-chromatic/sequential

  // treemap dimension
  const width = document.getElementById('chart').clientWidth;
  const height = document.getElementById('chart').clientHeight;

  d3.treemap()
    .tile(d3.treemapSquarify)
    .size([width, height])
    .padding(2)
    .round(true)(root);

  const svg = d3.select("#chart").append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("style", "font: 10px sans-serif;");

  // track selected category
  let selectedCategory = null;

  const treemapGroup = svg.append("g");

  // cell for each leaf of the hierarchy
  const leaf = treemapGroup.selectAll("g")
    .data(root.leaves())
    .join("g")
    .attr("class", "treemap-cell")
    .attr("transform", d => `translate(${d.x0},${d.y0})`)
    .on("click", function(event, d) {
      handleCellClick(d);
    });

  // tooltip
  const format = d3.format(",d");
  leaf.append("title")
      .text(d => `${d.data.name}\nГалузь: ${d.data.category}\nЗагалом: ${format(d.value)}\nЧоловіки: ${d.data.maleCount}\nЖінки: ${d.data.femaleCount}`);

  // color rectangle
  leaf.append("rect")
      .attr("fill", d => {
        const maleRatio = d.data.maleCount / d.value;
        return color(maleRatio);
      })
      .attr("fill-opacity", 0.8)
      .attr("width", d => d.x1 - d.x0)
      .attr("height", d => d.y1 - d.y0)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1);

  // minimum area threshold for displaying text
  const minAreaThreshold = 1500; // this hides the overflowing text in small cells so it doesn't look ugly

  // calculate appropriate font size based on cell dimensions
  function getFontSize(cellWidth, cellHeight) {
    const minDimension = Math.min(cellWidth, cellHeight);
    if (minDimension < 50) return 8;
    if (minDimension < 80) return 9;
    if (minDimension < 120) return 10;
    return 11; 
  }

  // get truncated text that fits in cell
  function getTruncatedText(text, cellWidth, fontSize) {
    // each character is about 0.6 * fontSize pixels wide
    const charWidth = fontSize * 0.6;
    const availableWidth = cellWidth - 8; // 4px padding on each side
    const maxChars = Math.floor(availableWidth / charWidth);
    
    if (text.length <= maxChars) return text;
    return text.substring(0, Math.max(1, maxChars - 3)) + "...";
  }

  leaf.each(function(d) {
    const cellWidth = d.x1 - d.x0;
    const cellHeight = d.y1 - d.y0;
    const cellArea = cellWidth * cellHeight;

    if (cellArea > minAreaThreshold) {
      const fontSize = getFontSize(cellWidth, cellHeight);
      const truncatedName = getTruncatedText(d.data.name, cellWidth, fontSize);

      // add department name
      d3.select(this).append("text")
        .attr("class", "treemap-text")
        .attr("x", 4)
        .attr("y", 14)
        .style("font-size", fontSize + "px")
        .text(truncatedName);

      // stats
      if (cellArea > 5000 && cellHeight > 35) {
        d3.select(this).append("text")
          .attr("class", "treemap-stats")
          .attr("x", 4)
          .attr("y", 26)
          .style("font-size", Math.max(8, fontSize - 1) + "px")
          .text(`Total: ${d.value}`);
      }

      // gender breakdown
      if (cellArea > 7000 && cellHeight > 50) {
        d3.select(this).append("text")
          .attr("class", "treemap-stats")
          .attr("x", 4)
          .attr("y", 38)
          .style("font-size", Math.max(8, fontSize - 1) + "px")
          .text(`M: ${d.data.maleCount} F: ${d.data.femaleCount}`);
      }
    }
  });

  // highlight on click
  function handleCellClick(clickedData) {
    const clickedCategory = clickedData.data.category;
    
    if (selectedCategory === clickedCategory) {
      // find the same category
      selectedCategory = null;
      leaf.classed("highlighted", false)
          .classed("dimmed", false);
      d3.select("#info-panel").style("display", "none");
    } else {
      selectedCategory = clickedCategory;
      
      // highlight cells in the same category, dim others
      leaf.classed("highlighted", d => d.data.category === selectedCategory)
          .classed("dimmed", d => d.data.category !== selectedCategory);
      
      // info panel with category details
      const categoryData = root.leaves().filter(d => d.data.category === selectedCategory);
      const totalInCategory = categoryData.reduce((sum, d) => sum + d.value, 0);
      const departmentsInCategory = categoryData.length;
      const menInCategory = categoryData.reduce((sum, d) => sum + d.data.maleCount, 0);
      const womenInCategory = categoryData.reduce((sum, d) => sum + d.data.femaleCount, 0);
      const menPercentageInCategory = (menInCategory / totalInCategory) * 100;
      const womenPercentageInCategory = (womenInCategory / totalInCategory) * 100;

      
      d3.select("#category-info")
        .html(`<strong>${selectedCategory}</strong><br>
               Спеціяльності: ${departmentsInCategory}<br>
               Вступники: ${totalInCategory}<br>
               Чоловіки: ${menInCategory} (${menPercentageInCategory.toFixed(2)}%)<br>
               Жінки: ${womenInCategory} (${womenPercentageInCategory.toFixed(2)}%)`);
      
      d3.select("#info-panel").style("display", "block");
    }
  }

  // reset button
  d3.select("#reset-button").on("click", function() {
    selectedCategory = null;
    leaf.classed("highlighted", false)
        .classed("dimmed", false);
    d3.select("#info-panel").style("display", "none");
  });

  // legend
  const legendItems = [
    { color: color(0), label: "Переважно жінки" },
    { color: color(0.25), label: "Більшість жінки" },
    { color: color(0.5), label: "Збалансована спеціяльність" },
    { color: color(0.75), label: "Більшість чоловіки" },
    { color: color(1), label: "Переважно чоловіки" }
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

  // listener
  window.addEventListener('resize', function() {
    const newWidth = document.getElementById('chart').clientWidth;
    const newHeight = document.getElementById('chart').clientHeight;

    d3.treemap()
      .tile(d3.treemapSquarify)
      .size([newWidth, newHeight])
      .padding(2)
      .round(true)(root);

    leaf.attr("transform", d => `translate(${d.x0},${d.y0})`);
    
    leaf.select("rect")
      .attr("width", d => d.x1 - d.x0)
      .attr("height", d => d.y1 - d.y0);

    // update text based on new cell sizes and area threshold
    leaf.selectAll("text").remove();
    
    leaf.each(function(d) {
      const cellWidth = d.x1 - d.x0;
      const cellHeight = d.y1 - d.y0;
      const cellArea = cellWidth * cellHeight;

      if (cellArea > minAreaThreshold) {
        const fontSize = getFontSize(cellWidth, cellHeight);
        const truncatedName = getTruncatedText(d.data.name, cellWidth, fontSize);

        d3.select(this).append("text")
          .attr("class", "treemap-text")
          .attr("x", 4)
          .attr("y", 14)
          .style("font-size", fontSize + "px")
          .text(truncatedName);

        if (cellArea > 5000 && cellHeight > 35) {
          d3.select(this).append("text")
            .attr("class", "treemap-stats")
            .attr("x", 4)
            .attr("y", 26)
            .style("font-size", Math.max(8, fontSize - 1) + "px")
            .text(`Загалом: ${d.value}`);
        }

        if (cellArea > 7000 && cellHeight > 50) {
          d3.select(this).append("text")
            .attr("class", "treemap-stats")
            .attr("x", 4)
            .attr("y", 38)
            .style("font-size", Math.max(8, fontSize - 1) + "px")
            .text(`Ч: ${d.data.maleCount} Ж: ${d.data.femaleCount}`);
        }
      }
    });
  });

}).catch(error => {
  console.error("Error loading data:", error);
});
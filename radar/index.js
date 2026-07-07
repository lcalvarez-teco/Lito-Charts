(function () {
  var DSCC_URL = "https://cdn.jsdelivr.net/npm/@google/dscc@0.4/build/dscc.min.js";
  var CHART_URL = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";

  var chartInstance = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        resolve();
        return;
      }
      var script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = function () {
        reject(new Error("No se pudo cargar: " + src));
      };
      document.head.appendChild(script);
    });
  }

  function getStyle(data, key, fallback) {
    try {
      if (data && data.style && data.style[key] && data.style[key].value !== undefined) {
        return data.style[key].value;
      }
    } catch (e) {}
    return fallback;
  }

  function toNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    var n = Number(String(value).replace(",", "."));
    return isNaN(n) ? null : n;
  }

  function fieldName(field, fallback) {
    if (!field) return fallback;
    return field.name || field.label || field.id || fallback;
  }

  function getRows(data) {
    if (!data || !data.tables) return [];
    return data.tables.DEFAULT || [];
  }

  function getMetricFields(data) {
    try {
      var fields = data.fields.values || [];
      return fields.map(function (group) {
        return group.metric && group.metric[0] ? group.metric[0] : null;
      }).filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  function transform(data) {
    var rows = getRows(data);
    var labels = [];
    var seriesOne = [];
    var seriesTwo = [];

    rows.forEach(function (row) {
      var dim = row.concepts && row.concepts[0] && row.concepts[0].dimension
        ? row.concepts[0].dimension[0]
        : null;

      var label = dim ? dim.value : "";
      if (!label) return;

      var valuesGroup = row.values || [];
      var m1 = valuesGroup[0] && valuesGroup[0].metric ? valuesGroup[0].metric[0] : null;
      var m2 = valuesGroup[1] && valuesGroup[1].metric ? valuesGroup[1].metric[0] : null;

      labels.push(label);
      seriesOne.push(m1 ? toNumber(m1.value) : null);
      seriesTwo.push(m2 ? toNumber(m2.value) : null);
    });

    return {
      labels: labels,
      seriesOne: seriesOne,
      seriesTwo: seriesTwo
    };
  }

  function renderMessage(message) {
    document.body.innerHTML = '<div id="root"><div class="lito-message">' + message + '</div></div>';
  }

  function render(data) {
    var t = transform(data);

    if (!t.labels.length) {
      renderMessage("No hay datos para mostrar. Verificá la dimensión y las métricas.");
      return;
    }

    var showTitle = getStyle(data, "showTitle", true);
    var titleText = getStyle(data, "titleText", "Autoevaluación vs Equipo");
    var subtitleText = getStyle(data, "subtitleText", "Promedio por eje");

    var minValue = toNumber(getStyle(data, "minValue", "0"));
    var maxValue = toNumber(getStyle(data, "maxValue", "5"));
    var stepSize = toNumber(getStyle(data, "stepSize", "1"));

    if (minValue === null) minValue = 0;
    if (maxValue === null) maxValue = 5;
    if (stepSize === null) stepSize = 1;

    var metricFields = getMetricFields(data);
    var seriesOneLabel = getStyle(data, "seriesOneLabel", fieldName(metricFields[0], "Autoevaluación"));
    var seriesTwoLabel = getStyle(data, "seriesTwoLabel", fieldName(metricFields[1], "Equipo"));

    document.body.innerHTML =
      '<div id="root">' +
        (showTitle ? '<h3 class="lito-title">' + titleText + '</h3>' : '') +
        (subtitleText ? '<div class="lito-subtitle">' + subtitleText + '</div>' : '') +
        '<div class="lito-chart-wrap"><canvas id="litoRadarCanvas"></canvas></div>' +
      '</div>';

    var ctx = document.getElementById("litoRadarCanvas").getContext("2d");

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    var datasets = [
      {
        label: seriesOneLabel,
        data: t.seriesOne,
        borderColor: "#2563eb",
        backgroundColor: "rgba(37, 99, 235, 0.14)",
        pointBackgroundColor: "#2563eb",
        pointBorderColor: "#2563eb",
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 5,
        tension: 0.15
      }
    ];

    var hasSecondSeries = t.seriesTwo.some(function (v) { return v !== null; });
    if (hasSecondSeries) {
      datasets.push({
        label: seriesTwoLabel,
        data: t.seriesTwo,
        borderColor: "#16a34a",
        backgroundColor: "rgba(22, 163, 74, 0.14)",
        pointBackgroundColor: "#16a34a",
        pointBorderColor: "#16a34a",
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 5,
        tension: 0.15
      });
    }

    chartInstance = new Chart(ctx, {
      type: "radar",
      data: {
        labels: t.labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 450 },
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: {
              color: "#374151",
              boxWidth: 12,
              usePointStyle: true,
              font: { size: 12 }
            }
          },
          tooltip: {
            enabled: true,
            callbacks: {
              label: function (context) {
                var value = context.raw;
                return context.dataset.label + ": " + (value === null ? "Sin dato" : Number(value).toFixed(2));
              }
            }
          }
        },
        scales: {
          r: {
            min: minValue,
            max: maxValue,
            ticks: {
              stepSize: stepSize,
              backdropColor: "transparent",
              color: "#6b7280",
              font: { size: 10 }
            },
            pointLabels: {
              color: "#111827",
              font: { size: 12, weight: "500" }
            },
            grid: { color: "rgba(156, 163, 175, 0.35)" },
            angleLines: { color: "rgba(156, 163, 175, 0.35)" }
          }
        }
      }
    });
  }

  Promise.all([loadScript(DSCC_URL), loadScript(CHART_URL)])
    .then(function () {
      if (!window.dscc) {
        renderMessage("No se pudo cargar DSCC.");
        return;
      }
      window.dscc.subscribeToData(render, { transform: window.dscc.objectTransform });
    })
    .catch(function (err) {
      renderMessage(err.message || "Error al cargar Lito Radar Chart.");
    });
})();

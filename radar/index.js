(function () {
  'use strict';

  var chartInstance = null;
  var loadStarted = false;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function loadDependencies() {
    if (loadStarted) return Promise.resolve();
    loadStarted = true;

    var loads = [];

    if (!window.dscc) {
      loads.push(loadScript('https://cdn.jsdelivr.net/npm/@google/dscc@0.4/build/dscc.min.js'));
    }

    if (!window.Chart) {
      loads.push(loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js'));
    }

    return Promise.all(loads);
  }

  function getStyleValue(data, key, fallback) {
    try {
      if (data.style && data.style[key] && data.style[key].value !== undefined) {
        return data.style[key].value;
      }
    } catch (e) {}
    return fallback;
  }

  function asNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    var n = Number(value);
    return isNaN(n) ? null : n;
  }

  function getFieldName(data, fieldId, fallback) {
    try {
      var fields = data.fields || {};
      var fieldGroup = fields[fieldId] || [];
      if (fieldGroup[0] && fieldGroup[0].name) return fieldGroup[0].name;
    } catch (e) {}
    return fallback;
  }

  function normalizeRows(data) {
    var rows = [];

    if (data && data.tables && data.tables.DEFAULT) {
      rows = data.tables.DEFAULT;
    }

    var labels = [];
    var serie1 = [];
    var serie2 = [];

    rows.forEach(function (row) {
      var dim = row.axisDimension && row.axisDimension[0] ? row.axisDimension[0].value : '';
      var metrics = row.seriesMetrics || [];

      if (!dim) return;

      labels.push(String(dim));
      serie1.push(metrics[0] ? asNumber(metrics[0].value) : null);
      serie2.push(metrics[1] ? asNumber(metrics[1].value) : null);
    });

    return {
      labels: labels,
      serie1: serie1,
      serie2: serie2
    };
  }

  function clearChart() {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
  }

  function draw(data) {
    var normalized = normalizeRows(data);
    var showTitle = getStyleValue(data, 'showTitle', true);
    var titleText = getStyleValue(data, 'titleText', 'AUTOEVALUACIÓN vs EQUIPO');
    var subtitleText = getStyleValue(data, 'subtitleText', 'Promedio por eje');
    var maxScale = Number(getStyleValue(data, 'maxScale', '5')) || 5;

    var metric1Name = getFieldName(data, 'seriesMetrics', 'Autoevaluación');
    var metric2Name = 'Equipo';

    try {
      var metrics = data.fields.seriesMetrics || [];
      if (metrics[0] && metrics[0].name) metric1Name = metrics[0].name;
      if (metrics[1] && metrics[1].name) metric2Name = metrics[1].name;
    } catch (e) {}

    document.body.innerHTML =
      '<div id="viz">' +
        (showTitle ? '<h3 class="lito-title">' + titleText + '</h3>' : '') +
        '<div class="lito-subtitle">' + subtitleText + '</div>' +
        '<div class="lito-chart-wrap"><canvas id="litoRadar"></canvas></div>' +
      '</div>';

    if (!normalized.labels.length) {
      clearChart();
      document.querySelector('.lito-chart-wrap').innerHTML =
        '<div class="lito-empty">Sin datos para mostrar.<br>Agregá una dimensión y una o dos métricas.</div>';
      return;
    }

    var ctx = document.getElementById('litoRadar').getContext('2d');
    clearChart();

    var datasets = [
      {
        label: metric1Name,
        data: normalized.serie1,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.14)',
        pointBackgroundColor: '#2563eb',
        pointBorderColor: '#2563eb',
        pointRadius: 4,
        borderWidth: 2,
        fill: true
      }
    ];

    if (normalized.serie2.some(function (v) { return v !== null; })) {
      datasets.push({
        label: metric2Name,
        data: normalized.serie2,
        borderColor: '#16a34a',
        backgroundColor: 'rgba(22, 163, 74, 0.14)',
        pointBackgroundColor: '#16a34a',
        pointBorderColor: '#16a34a',
        pointRadius: 4,
        borderWidth: 2,
        fill: true
      });
    }

    chartInstance = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: normalized.labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 450 },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              color: '#374151',
              font: { size: 12 }
            }
          },
          tooltip: {
            enabled: true,
            callbacks: {
              label: function (context) {
                var value = context.raw;
                if (value === null || value === undefined) return context.dataset.label + ': Sin dato';
                return context.dataset.label + ': ' + Number(value).toFixed(2).replace('.', ',');
              }
            }
          }
        },
        scales: {
          r: {
            min: 0,
            max: maxScale,
            ticks: {
              stepSize: 1,
              backdropColor: 'transparent',
              color: '#6b7280',
              font: { size: 10 }
            },
            pointLabels: {
              color: '#111827',
              font: { size: 12, weight: '600' }
            },
            grid: { color: 'rgba(156, 163, 175, 0.35)' },
            angleLines: { color: 'rgba(156, 163, 175, 0.35)' }
          }
        }
      }
    });
  }

  loadDependencies()
    .then(function () {
      if (window.dscc) {
        window.dscc.subscribeToData(draw, { transform: window.dscc.objectTransform });
      } else {
        document.body.innerHTML = '<div class="lito-empty">No se pudo cargar DSCC.</div>';
      }
    })
    .catch(function (err) {
      document.body.innerHTML = '<div class="lito-empty">Error al cargar Lito Radar.<br>' + err + '</div>';
    });
})();

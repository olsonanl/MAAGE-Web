define([
	"dojo/_base/declare",
	"dojo/_base/lang",
	"dojo/on",
	"dojo/dom-class",
	"dojo/topic",
	"dijit/_WidgetBase",
	"dijit/_WidgetsInTemplateMixin",
	"dijit/_TemplatedMixin",
	"dojo/text!./templates/GenomeListOverview.html",
	"p3/store/GenomeJsonRest",
	"./EChartVerticalBar",
	"./EChartDoughnut",
	"./EChartStackedBar",
	"./EChartHorizontalBar",
	"./EChartAMRStackedBar",
	"./D3Choropleth",
	"p3/store/AMRJsonRest",
	"./GenomeListSummary"
], function (
	declare,
	lang,
	on,
	domClass,
	Topic,
	WidgetBase,
	_WidgetsInTemplateMixin,
	Templated,
	Template,
	GenomeStore,
	VerticalBar,
	Doughnut,
	StackedBar,
	HorizontalBar,
	AMRStackedBar,
	Choropleth,
	AMRStore,
	GenomeListSummary
)
{
	return declare([WidgetBase, Templated, _WidgetsInTemplateMixin], {
		baseClass: "GenomeListOverview",
		templateString: Template,
		state: null,
		charts: [],
		amrChart: null,
		mapChart: null,
		summaryWidget: null,
		sequencingCentersChart: null,
		taxonomyChart: null,
		cgmlstChart: null,

		postCreate: function ()
		{
			this.inherited(arguments);
			this.genomeStore = new GenomeStore({});
			this.amrStore = new AMRStore({});
			this.currentTaxonomyField = "genus"; // Default to genus
			this.currentCgmlstField = "cgmlst_hc0"; // Default to HC0

			this.own(
				on(this.genusBtn, "click", lang.hitch(this, function ()
				{
					this.switchTaxonomyView("genus");
				})),
				on(this.speciesBtn, "click", lang.hitch(this, function ()
				{
					this.switchTaxonomyView("species");
				})),
				on(this.amrCountBtn, "click", lang.hitch(this, function ()
				{
					this.switchAMRView("count");
				})),
				on(this.amrPercentBtn, "click", lang.hitch(this, function ()
				{
					this.switchAMRView("percent");
				})),
				on(this.amrSortNameBtn, "click", lang.hitch(this, function ()
				{
					this.switchAMRSort("name");
				})),
				on(this.amrSortValueBtn, "click", lang.hitch(this, function ()
				{
					this.switchAMRSort("value");
				})),
				on(this.cgmlstHC0Btn, "click", lang.hitch(this, function ()
				{
					this.switchCgmlstView("cgmlst_hc0");
				})),
				on(this.cgmlstHC2Btn, "click", lang.hitch(this, function ()
				{
					this.switchCgmlstView("cgmlst_hc2");
				})),
				on(this.cgmlstHC5Btn, "click", lang.hitch(this, function ()
				{
					this.switchCgmlstView("cgmlst_hc5");
				})),
				on(this.cgmlstHC10Btn, "click", lang.hitch(this, function ()
				{
					this.switchCgmlstView("cgmlst_hc10");
				})),
				on(this.cgmlstHC20Btn, "click", lang.hitch(this, function ()
				{
					this.switchCgmlstView("cgmlst_hc20");
				})),
				on(this.cgmlstHC50Btn, "click", lang.hitch(this, function ()
				{
					this.switchCgmlstView("cgmlst_hc50");
				})),
				on(this.cgmlstHC100Btn, "click", lang.hitch(this, function ()
				{
					this.switchCgmlstView("cgmlst_hc100");
				}))
			);
		},

		startup: function ()
		{
			this.inherited(arguments);

			if (this.state && this.state.search)
			{
				setTimeout(lang.hitch(this, function ()
				{
					this.createCharts();
				}), 100);
			}
		},

		_setStateAttr: function (state)
		{
			this._set("state", state);
			if (this._started && this.state && this.state.search)
			{

				setTimeout(lang.hitch(this, function ()
				{
					this.createCharts();
				}), 100);
			}
		},


		switchTaxonomyView: function (field)
		{
			if (this.currentTaxonomyField === field || !this.taxonomyChart) return;

			this.currentTaxonomyField = field;
			domClass.toggle(this.genusBtn, "active", field === "genus");
			domClass.toggle(this.speciesBtn, "active", field === "species");

			// Recreate the chart with the new field
			this.createTaxonomyChart();
		},

		switchCgmlstView: function (field)
		{
			if (this.currentCgmlstField === field || !this.cgmlstChart) return;

			this.currentCgmlstField = field;
			domClass.toggle(this.cgmlstHC0Btn, "active", field === "cgmlst_hc0");
			domClass.toggle(this.cgmlstHC2Btn, "active", field === "cgmlst_hc2");
			domClass.toggle(this.cgmlstHC5Btn, "active", field === "cgmlst_hc5");
			domClass.toggle(this.cgmlstHC10Btn, "active", field === "cgmlst_hc10");
			domClass.toggle(this.cgmlstHC20Btn, "active", field === "cgmlst_hc20");
			domClass.toggle(this.cgmlstHC50Btn, "active", field === "cgmlst_hc50");
			domClass.toggle(this.cgmlstHC100Btn, "active", field === "cgmlst_hc100");

			// Recreate the chart with the new field
			this.createCgmlstChart();
		},

		switchAMRView: function (viewMode)
		{
			if (!this.amrChart) return;

			domClass.toggle(this.amrCountBtn, "active", viewMode === "count");
			domClass.toggle(this.amrPercentBtn, "active", viewMode === "percent");

			this.amrChart.setViewMode(viewMode);
		},

		switchAMRSort: function (sortBy)
		{
			if (!this.amrChart) return;

			domClass.toggle(this.amrSortNameBtn, "active", sortBy === "name");
			domClass.toggle(this.amrSortValueBtn, "active", sortBy === "value");

			this.amrChart.setSortBy(sortBy);
		},

		_processFacets: function (facets)
		{
			if (!facets || facets.length === 0) return [];
			const normMap = {
				stool: "Stool",
				"whole blood": "Blood",
				blood: "Blood",
				urine: "Urine",
				wound: "Wound",
				unknown: "Unknown",
				na: "N/A",
				"n/a": "N/A",
			};
			const agg = {};
			for (let i = 0; i < facets.length; i += 2)
			{
				const name = facets[i] || "N/A",
					count = facets[i + 1] || 0;
				if (count > 0)
				{
					const finalName = normMap[name.toLowerCase()] || name.charAt(0).toUpperCase() + name.slice(1);
					agg[finalName] = (agg[finalName] || 0) + count;
				}
			}
			return Object.keys(agg)
				.map((k) => ({ name: k, value: agg[k] }))
				.sort((a, b) => b.value - a.value);
		},

		_processPivotFacets: function (pivotData)
		{
			if (!pivotData || pivotData.length === 0) return { categories: [], series: [] };
			const allYears = [...new Set(pivotData.map((p) => parseInt(p.value, 10)))].filter((y) => !isNaN(y)).sort();
			if (allYears.length === 0) return { categories: [], series: [] };
			const maxYearInCategories = allYears[allYears.length - 1];
			const startYear = maxYearInCategories - 9;
			const recentPivotData = pivotData.filter((p) => parseInt(p.value, 10) >= startYear);
			const categories = [...new Set(recentPivotData.map((p) => p.value))].sort();
			const seriesCounts = {};
			recentPivotData.forEach((yearData) =>
			{
				if (yearData.pivot)
				{
					yearData.pivot.forEach((seriesData) =>
					{
						seriesCounts[seriesData.value] = (seriesCounts[seriesData.value] || 0) + seriesData.count;
					});
				}
			});
			const topSeriesNames = Object.keys(seriesCounts)
				.sort((a, b) => seriesCounts[b] - seriesCounts[a])
				.slice(0, 10);
			const series = topSeriesNames.map((seriesName) => ({
				name: seriesName || "N/A",
				data: categories.map((category) =>
				{
					const categoryData = recentPivotData.find((p) => p.value === category);
					const seriesPoint =
						categoryData && categoryData.pivot
							? categoryData.pivot.find((p) => p.value === seriesName)
							: null;
					return seriesPoint ? seriesPoint.count : 0;
				}),
			}));
			return { categories: categories, series: series };
		},

		createCharts: function ()
		{
			this.charts.forEach((chart) => chart.destroy());
			this.charts = [];

			const baseQuery = this.state.search;
			const queryOptions = { headers: { Accept: "application/solr+json" } };

			const createChart = (widgetClass, node, query, theme) =>
			{
				if (!node) return;

				const checkAndCreate = () =>
				{
					const rect = node.getBoundingClientRect();
					if (rect.width > 0 && rect.height > 0)
					{
						const chart = new widgetClass({
							title: "",
							theme: theme || "maage-echarts-theme",
						});
						chart.placeAt(node);
						chart.startup();
						chart.showLoading();

						setTimeout(() =>
						{
							if (chart.resize)
							{
								chart.resize();
							}
						}, 100);

						this.genomeStore.query(query, queryOptions).then(
							lang.hitch(this, (res) =>
							{
								const field = query.match(/facet\(\(field,(\w+)\)/)[1];
								if (res && res.facet_counts && res.facet_counts.facet_fields[field])
								{
									const data = this._processFacets(res.facet_counts.facet_fields[field]);
									chart.updateChart(data);
								}
								chart.hideLoading();

								setTimeout(() =>
								{
									if (chart.resize)
									{
										chart.resize();
									}
								}, 50);
							}),
							lang.hitch(this, () =>
							{
								chart.hideLoading();
							})
						);
						this.charts.push(chart);
					} else
					{

						setTimeout(checkAndCreate, 100);
					}
				};

				checkAndCreate();
			};

			const createPivotChart = (widgetClass, node, query, theme) =>
			{
				if (!node) return;

				const checkAndCreate = () =>
				{
					const rect = node.getBoundingClientRect();
					if (rect.width > 0 && rect.height > 0)
					{
						const chart = new widgetClass({
							title: "",
							theme: theme || "maage-echarts-theme",
						});
						chart.placeAt(node);
						chart.startup();
						chart.showLoading();

						setTimeout(() =>
						{
							if (chart.resize)
							{
								chart.resize();
							}
						}, 100);

						this.genomeStore.query(query, queryOptions).then(
							lang.hitch(this, (res) =>
							{
								const pivotField = query.match(/facet\(\(pivot,\(([^,]+),([^)]+)\)\)/);
								const pivotKey = `${pivotField[1]},${pivotField[2]}`;
								const pivotData = res.facet_counts.facet_pivot[pivotKey];
								if (pivotData)
								{
									const data = this._processPivotFacets(pivotData);
									chart.updateChart(data);
								}
								chart.hideLoading();

								setTimeout(() =>
								{
									if (chart.resize)
									{
										chart.resize();
									}
								}, 50);
							}),
							lang.hitch(this, () =>
							{
								chart.hideLoading();
							})
						);
						this.charts.push(chart);
					} else
					{

						setTimeout(checkAndCreate, 100);
					}
				};

				checkAndCreate();
			};

			this.createSummaryWidget();

			this.createMapChart();
			this.createSequencingCentersChart();
			this.createTaxonomyChart();
			this.createCgmlstChart();
			this.createSerotypeChart();
			this.createSerotypeOverTimeChart();
			this.createHostChart();
			this.createIsolationSourceChart();

			this.createYearlyCountChart();
			this.createAMRChart();
		},

		_createChartWhenReady: function (node, widgetClass, options, dataLoader)
		{
			if (!node) return;

			const checkAndCreate = () =>
			{
				const rect = node.getBoundingClientRect();
				if (rect.width > 0 && rect.height > 0)
				{
					const chart = new widgetClass(options);
					chart.placeAt(node);
					chart.startup();
					chart.showLoading();

					setTimeout(() =>
					{
						if (chart.resize)
						{
							chart.resize();
						}
					}, 100);

					dataLoader(chart);

					this.charts.push(chart);
				} else
				{

					setTimeout(checkAndCreate, 100);
				}
			};

			checkAndCreate();
		},

		createSequencingCentersChart: function ()
		{
			if (!this.sequencingCentersChartNode || !this.state || !this.state.search) return;

			const baseQuery = this.state.search;
			const query = `${baseQuery}&facet((field,sequencing_centers),(mincount,1),(limit,10))&limit(0)`;

			this._createChartWhenReady(
				this.sequencingCentersChartNode,
				Doughnut,
				{
					title: "",
					theme: "maage-muted"
				},
				lang.hitch(this, function (chart)
				{
					const queryOptions = { headers: { Accept: "application/solr+json" } };

					this.genomeStore.query(query, queryOptions).then(
						lang.hitch(this, function (res)
						{
							if (res && res.facet_counts && res.facet_counts.facet_fields.sequencing_centers)
							{
								const data = this._processFacets(res.facet_counts.facet_fields.sequencing_centers);

								const option = {
									tooltip: {
										trigger: "item",
										formatter: "{b}: {c} ({d}%)",
									},
									legend: {
										type: data.length > 20 ? 'scroll' : 'plain',
										orient: 'horizontal',
										bottom: '5%',
										left: 'center',
										width: '90%',
										data: data.map((item) => item.name),
										itemGap: 8,
										itemWidth: 18,
										itemHeight: 10,
										textStyle: {
											fontSize: 11
										},
										pageButtonItemGap: 5,
										pageButtonGap: 15,
										pageIconSize: 12,
										pageTextStyle: {
											fontSize: 10
										}
									},
									grid: {
										top: '10%',
										bottom: '25%'
									},
									series: [
										{
											name: "Sequencing Centers",
											type: "pie",
											radius: ["40%", "60%"],
											center: ['50%', '40%'],
											avoidLabelOverlap: false,
											label: { show: false },
											emphasis: {
												label: { show: true, fontSize: "14", fontWeight: "bold" },
											},
											labelLine: { show: false },
											data: data,
										},
									],
								};
								chart.chart.setOption(option);

								// Add click handler for chart segments
								chart.chart.on('click', lang.hitch(this, function (params)
								{
									if (params.componentType === 'series' && params.seriesType === 'pie')
									{
										const sequencingCenter = params.name;
										
										// Get the existing search query and preserve it
										let existingQuery = this.state.search;
										
										// URL encode the sequencing center value if it contains special characters
										let encodedCenter;
										if (/[^a-zA-Z0-9_.-]/.test(sequencingCenter))
										{
											// Replace common special characters and wrap in quotes
											const urlEncoded = sequencingCenter
												.replace(/\//g, '%2F')
												.replace(/:/g, '%3A')
												.replace(/\s/g, '%20');
											encodedCenter = `"${urlEncoded}"`;
										}
										else
										{
											encodedCenter = sequencingCenter;
										}
										
										// Build the new query by appending the sequencing center filter to existing conditions
										let newQuery;
										if (existingQuery.startsWith('and('))
										{
											// If already an 'and' query, append to it
											newQuery = existingQuery.slice(0, -1) + `,eq(sequencing_centers,${encodedCenter}))`;
										}
										else
										{
											// Wrap existing query with the new condition in an 'and'
											newQuery = `and(${existingQuery},eq(sequencing_centers,${encodedCenter}))`;
										}
										
										// Navigate to the genome list view with the combined filter
										Topic.publish('/navigate', {
											href: `/view/GenomeList/?${newQuery}#view_tab=genomes`
										});
									}
								}));
							}
							chart.hideLoading();

							setTimeout(() =>
							{
								if (chart.resize)
								{
									chart.resize();
								}
							}, 50);
						}),
						lang.hitch(this, function ()
						{
							chart.hideLoading();
						})
					);

					this.sequencingCentersChart = chart;
				})
			);
		},

		createTaxonomyChart: function ()
		{
			if (!this.speciesChartNode || !this.state || !this.state.search) return;

			const baseQuery = this.state.search;
			const field = this.currentTaxonomyField; // Use the current taxonomy field
			const query = `${baseQuery}&facet((field,${field}),(mincount,1),(limit,10))&limit(0)`;

			// If we have an existing chart, destroy it
			if (this.taxonomyChart)
			{
				this.taxonomyChart.destroy();
				this.taxonomyChart = null;
			}

			this._createChartWhenReady(
				this.speciesChartNode,
				Doughnut,
				{
					title: `${field.charAt(0).toUpperCase() + field.slice(1)} Distribution`,
					theme: "maage-muted",
				},
				lang.hitch(this, function (chart)
				{
					const queryOptions = { headers: { Accept: "application/solr+json" } };

					this.genomeStore.query(query, queryOptions).then(
						lang.hitch(this, function (res)
						{
							if (res && res.facet_counts && res.facet_counts.facet_fields[field])
							{
								const data = this._processFacets(res.facet_counts.facet_fields[field]);

								const option = {
									tooltip: {
										trigger: "item",
										formatter: "{b}: {c} ({d}%)",
									},
									legend: {
										type: data.length > 20 ? 'scroll' : 'plain',
										orient: 'horizontal',
										bottom: '5%',
										left: 'center',
										width: '90%',
										data: data.map((item) => item.name),
										itemGap: 8,
										itemWidth: 18,
										itemHeight: 10,
										textStyle: {
											fontSize: 11
										},
										pageButtonItemGap: 5,
										pageButtonGap: 15,
										pageIconSize: 12,
										pageTextStyle: {
											fontSize: 10
										}
									},
									grid: {
										top: '10%',
										bottom: '25%'
									},
									series: [
										{
											name: `${field.charAt(0).toUpperCase() + field.slice(1)} Distribution`,
											type: "pie",
											radius: ["40%", "60%"],
											center: ['50%', '40%'],
											avoidLabelOverlap: false,
											label: { show: false },
											emphasis: {
												label: { show: true, fontSize: "14", fontWeight: "bold" },
											},
											labelLine: { show: false },
											data: data,
										},
									],
								};
								chart.chart.setOption(option);

								// Add click handler for chart segments
								chart.chart.on('click', lang.hitch(this, function (params)
								{
									if (params.componentType === 'series' && params.seriesType === 'pie')
									{
										const taxonomyValue = params.name;
										
										// Get the existing search query and preserve it
										let existingQuery = this.state.search;
										
										// URL encode the taxonomy value if it contains special characters
										let encodedValue;
										if (/[^a-zA-Z0-9_.-]/.test(taxonomyValue))
										{
											// Replace common special characters and wrap in quotes
											const urlEncoded = taxonomyValue
												.replace(/\//g, '%2F')
												.replace(/:/g, '%3A')
												.replace(/\s/g, '%20');
											encodedValue = `"${urlEncoded}"`;
										}
										else
										{
											encodedValue = taxonomyValue;
										}
										
										// Build the new query by appending the taxonomy filter to existing conditions
										let newQuery;
										if (existingQuery.startsWith('and('))
										{
											// If already an 'and' query, append to it
											newQuery = existingQuery.slice(0, -1) + `,eq(${field},${encodedValue}))`;
										}
										else
										{
											// Wrap existing query with the new condition in an 'and'
											newQuery = `and(${existingQuery},eq(${field},${encodedValue}))`;
										}
										
										// Navigate to the genome list view with the combined filter
										Topic.publish('/navigate', {
											href: `/view/GenomeList/?${newQuery}#view_tab=genomes`
										});
									}
								}));
							}
							chart.hideLoading();

							setTimeout(() =>
							{
								if (chart.resize)
								{
									chart.resize();
								}
							}, 50);
						}),
						lang.hitch(this, function ()
						{
							chart.hideLoading();
						})
					);

					this.taxonomyChart = chart;
				})
			);
		},

		createCgmlstChart: function ()
		{
			if (!this.cgmlstChartNode || !this.state || !this.state.search) return;

			const baseQuery = this.state.search;
			const field = this.currentCgmlstField; // Use the current cgMLST HC field
			const query = `${baseQuery}&facet((field,${field}),(mincount,1),(limit,10))&limit(0)`;

			// If we have an existing chart, destroy it
			if (this.cgmlstChart)
			{
				this.cgmlstChart.destroy();
				this.cgmlstChart = null;
			}

			// Get the display label for the field
			const fieldLabel = field.replace('cgmlst_', '').toUpperCase();

			this._createChartWhenReady(
				this.cgmlstChartNode,
				Doughnut,
				{
					title: `${fieldLabel} Distribution`,
					theme: "maage-muted",
				},
				lang.hitch(this, function (chart)
				{
					const queryOptions = { headers: { Accept: "application/solr+json" } };

					this.genomeStore.query(query, queryOptions).then(
						lang.hitch(this, function (res)
						{
							if (res && res.facet_counts && res.facet_counts.facet_fields[field])
							{
								const data = this._processFacets(res.facet_counts.facet_fields[field]);

								const option = {
									tooltip: {
										trigger: "item",
										formatter: "{b}: {c} ({d}%)",
									},
									legend: {
										type: data.length > 20 ? 'scroll' : 'plain',
										orient: 'horizontal',
										bottom: '5%',
										left: 'center',
										width: '90%',
										data: data.map((item) => item.name),
										itemGap: 8,
										itemWidth: 18,
										itemHeight: 10,
										textStyle: {
											fontSize: 11
										},
										pageButtonItemGap: 5,
										pageButtonGap: 15,
										pageIconSize: 12,
										pageTextStyle: {
											fontSize: 10
										}
									},
									grid: {
										top: '10%',
										bottom: '25%'
									},
									series: [
										{
											name: `${fieldLabel} Distribution`,
											type: "pie",
											radius: ["40%", "60%"],
											center: ['50%', '40%'],
											avoidLabelOverlap: false,
											label: { show: false },
											emphasis: {
												label: { show: true, fontSize: "14", fontWeight: "bold" },
											},
											labelLine: { show: false },
											data: data,
										},
									],
								};
								chart.chart.setOption(option);

								// Add click handler for chart segments
								chart.chart.on('click', lang.hitch(this, function (params)
								{
									if (params.componentType === 'series' && params.seriesType === 'pie')
									{
										const cgmlstValue = params.name;
										
										// Get the existing search query and preserve it
										let existingQuery = this.state.search;
										
										// Properly encode the value if it contains special characters
										const encodedValue = /[^a-zA-Z0-9_.-]/.test(cgmlstValue) 
											? `"${cgmlstValue}"` 
											: cgmlstValue;
										
										// Build the new query by appending the cgMLST filter to existing conditions
										let newQuery;
										if (existingQuery.startsWith('and('))
										{
											// If already an 'and' query, append to it by removing the closing paren and adding new condition
											newQuery = existingQuery.slice(0, -1) + `,eq(${field},${encodedValue}))`;
										}
										else
										{
											// Wrap existing query with the new condition in an 'and'
											newQuery = `and(${existingQuery},eq(${field},${encodedValue}))`;
										}
										
										// Navigate to the genome list view with the combined filter
										Topic.publish('/navigate', {
											href: `/view/GenomeList/?${newQuery}#view_tab=genomes`
										});
									}
								}));
							}
							chart.hideLoading();

							setTimeout(() =>
							{
								if (chart.resize)
								{
									chart.resize();
								}
							}, 50);
						}),
						lang.hitch(this, function ()
						{
							chart.hideLoading();
						})
					);

					this.cgmlstChart = chart;
				})
			);
		},

		createSerotypeChart: function ()
		{
			if (!this.serotypeChartNode || !this.state || !this.state.search) return;

			const baseQuery = this.state.search;
			const query = `${baseQuery}&facet((field,serovar),(mincount,1),(limit,10))&limit(0)`;

			this._createChartWhenReady(
				this.serotypeChartNode,
				Doughnut,
				{
					title: "Serotypes",
					theme: "maage-muted",
				},
				lang.hitch(this, function (chart)
				{
					const queryOptions = { headers: { Accept: "application/solr+json" } };

					this.genomeStore.query(query, queryOptions).then(
						lang.hitch(this, function (res)
						{
							if (res && res.facet_counts && res.facet_counts.facet_fields.serovar)
							{
								const data = this._processFacets(res.facet_counts.facet_fields.serovar);

								const option = {
									tooltip: {
										trigger: "item",
										formatter: "{b}: {c} ({d}%)",
									},
									legend: {
										type: data.length > 20 ? 'scroll' : 'plain',
										orient: 'horizontal',
										bottom: '5%',
										left: 'center',
										width: '90%',
										data: data.map((item) => item.name),
										itemGap: 8,
										itemWidth: 18,
										itemHeight: 10,
										textStyle: {
											fontSize: 11
										},
										pageButtonItemGap: 5,
										pageButtonGap: 15,
										pageIconSize: 12,
										pageTextStyle: {
											fontSize: 10
										}
									},
									grid: {
										top: '10%',
										bottom: '25%'
									},
									series: [
										{
											name: "Serotypes",
											type: "pie",
											radius: ["40%", "60%"],
											center: ['50%', '40%'],
											avoidLabelOverlap: false,
											label: { show: false },
											emphasis: {
												label: { show: true, fontSize: "14", fontWeight: "bold" },
											},
											labelLine: { show: false },
											data: data,
										},
									],
								};
								chart.chart.setOption(option);

								// Add click handler for chart segments
								chart.chart.on('click', lang.hitch(this, function (params)
								{
									if (params.componentType === 'series' && params.seriesType === 'pie')
									{
										const serotype = params.name;
										
										// Get the existing search query and preserve it
										let existingQuery = this.state.search;
										
										// URL encode the serotype value, wrapping in quotes if it contains special characters
										let encodedSerotype;
										if (/[^a-zA-Z0-9_.-]/.test(serotype))
										{
											// Replace / with %2F and : with %3A, then wrap in quotes
											const urlEncoded = serotype.replace(/\//g, '%2F').replace(/:/g, '%3A');
											encodedSerotype = `"${urlEncoded}"`;
										}
										else
										{
											encodedSerotype = serotype;
										}
										
										// Build the new query by appending the serotype filter to existing conditions
										let newQuery;
										if (existingQuery.startsWith('and('))
										{
											// If already an 'and' query, append to it
											newQuery = existingQuery.slice(0, -1) + `,eq(serovar,${encodedSerotype}))`;
										}
										else
										{
											// Wrap existing query with the new condition in an 'and'
											newQuery = `and(${existingQuery},eq(serovar,${encodedSerotype}))`;
										}
										
										// Navigate to the genome list view with the combined filter
										Topic.publish('/navigate', {
											href: `/view/GenomeList/?${newQuery}#view_tab=genomes`
										});
									}
								}));
							}
							chart.hideLoading();

							setTimeout(() =>
							{
								if (chart.resize)
								{
									chart.resize();
								}
							}, 50);
						}),
						lang.hitch(this, function ()
						{
							chart.hideLoading();
						})
					);

					this.charts.push(chart);
				})
			);
		},

		createSerotypeOverTimeChart: function ()
		{
			if (!this.serotypeOverTimeChartNode || !this.state || !this.state.search) return;

			const baseQuery = this.state.search;
			const query = `${baseQuery}&facet((pivot,(collection_year,serovar)),(mincount,1))&limit(0)`;

			this._createChartWhenReady(
				this.serotypeOverTimeChartNode,
				StackedBar,
				{
					title: "",
					theme: "maage-muted",
				},
				lang.hitch(this, function (chart)
				{
					const queryOptions = { headers: { Accept: "application/solr+json" } };

					this.genomeStore.query(query, queryOptions).then(
						lang.hitch(this, function (res)
						{
							const pivotKey = "collection_year,serovar";
							const pivotData = res.facet_counts.facet_pivot[pivotKey];
							
							if (pivotData)
							{
								const data = this._processPivotFacets(pivotData);
								chart.updateChart(data);

								// Add click handler for chart segments
								chart.chart.on('click', lang.hitch(this, function (params)
								{
									// For stacked bar charts, we can get both the category (year) and series (serotype)
									if (params.componentType === 'series')
									{
										const year = params.name; // collection_year
										const serotype = params.seriesName; // serovar
										
										// Get the existing search query and preserve it
										let existingQuery = this.state.search;
										
										// URL encode the serotype value if it contains special characters
										let encodedSerotype;
										if (/[^a-zA-Z0-9_.-]/.test(serotype))
										{
											// Replace / with %2F and : with %3A, then wrap in quotes
											const urlEncoded = serotype.replace(/\//g, '%2F').replace(/:/g, '%3A');
											encodedSerotype = `"${urlEncoded}"`;
										}
										else
										{
											encodedSerotype = serotype;
										}
										
										// Build the new query by appending both year and serotype filters
										let newQuery;
										if (existingQuery.startsWith('and('))
										{
											// If already an 'and' query, append both conditions
											newQuery = existingQuery.slice(0, -1) + `,eq(collection_year,${year}),eq(serovar,${encodedSerotype}))`;
										}
										else
										{
											// Wrap existing query with the new conditions in an 'and'
											newQuery = `and(${existingQuery},eq(collection_year,${year}),eq(serovar,${encodedSerotype}))`;
										}
										
										// Navigate to the genome list view with the combined filter
										Topic.publish('/navigate', {
											href: `/view/GenomeList/?${newQuery}#view_tab=genomes`
										});
									}
								}));
							}
							chart.hideLoading();

							setTimeout(() =>
							{
								if (chart.resize)
								{
									chart.resize();
								}
							}, 50);
						}),
						lang.hitch(this, function ()
						{
							chart.hideLoading();
						})
					);

					this.charts.push(chart);
				})
			);
		},

		createHostChart: function ()
		{
			if (!this.hostChartNode || !this.state || !this.state.search) return;

			const baseQuery = this.state.search;
			const query = `${baseQuery}&facet((field,host_common_name),(mincount,1),(limit,10))&limit(0)`;

			this._createChartWhenReady(
				this.hostChartNode,
				Doughnut,
				{
					title: "",
					theme: "maage-muted",
				},
				lang.hitch(this, function (chart)
				{
					const queryOptions = { headers: { Accept: "application/solr+json" } };

					this.genomeStore.query(query, queryOptions).then(
						lang.hitch(this, function (res)
						{
							if (res && res.facet_counts && res.facet_counts.facet_fields.host_common_name)
							{
								const data = this._processFacets(res.facet_counts.facet_fields.host_common_name);
								chart.updateChart(data);

								// Add click handler for chart segments
								chart.chart.on('click', lang.hitch(this, function (params)
								{
									if (params.componentType === 'series')
									{
										const hostName = params.name;
										
										// Get the existing search query and preserve it
										let existingQuery = this.state.search;
										
										// URL encode the host name if it contains special characters
										let encodedHost;
										if (/[^a-zA-Z0-9_.-]/.test(hostName))
										{
											// Replace common special characters and wrap in quotes
											const urlEncoded = hostName
												.replace(/\//g, '%2F')
												.replace(/:/g, '%3A')
												.replace(/\s/g, '%20');
											encodedHost = `"${urlEncoded}"`;
										}
										else
										{
											encodedHost = hostName;
										}
										
										// Build the new query by appending the host filter to existing conditions
										let newQuery;
										if (existingQuery.startsWith('and('))
										{
											// If already an 'and' query, append to it
											newQuery = existingQuery.slice(0, -1) + `,eq(host_common_name,${encodedHost}))`;
										}
										else
										{
											// Wrap existing query with the new condition in an 'and'
											newQuery = `and(${existingQuery},eq(host_common_name,${encodedHost}))`;
										}
										
										// Navigate to the genome list view with the combined filter
										Topic.publish('/navigate', {
											href: `/view/GenomeList/?${newQuery}#view_tab=genomes`
										});
									}
								}));
							}
							chart.hideLoading();

							setTimeout(() =>
							{
								if (chart.resize)
								{
									chart.resize();
								}
							}, 50);
						}),
						lang.hitch(this, function ()
						{
							chart.hideLoading();
						})
					);

					this.charts.push(chart);
				})
			);
		},

		createIsolationSourceChart: function ()
		{
			if (!this.sourceChartNode || !this.state || !this.state.search) return;

			const baseQuery = this.state.search;
			const query = `${baseQuery}&facet((field,isolation_source),(mincount,1),(limit,10))&limit(0)`;

			this._createChartWhenReady(
				this.sourceChartNode,
				Doughnut,
				{
					title: "",
					theme: "maage-muted",
				},
				lang.hitch(this, function (chart)
				{
					const queryOptions = { headers: { Accept: "application/solr+json" } };

					this.genomeStore.query(query, queryOptions).then(
						lang.hitch(this, function (res)
						{
							if (res && res.facet_counts && res.facet_counts.facet_fields.isolation_source)
							{
								const data = this._processFacets(res.facet_counts.facet_fields.isolation_source);
								chart.updateChart(data);

								// Add click handler for chart segments
								chart.chart.on('click', lang.hitch(this, function (params)
								{
									if (params.componentType === 'series')
									{
										const sourceName = params.name;
										
										// Get the existing search query and preserve it
										let existingQuery = this.state.search;
										
										// URL encode the source name if it contains special characters
										let encodedSource;
										if (/[^a-zA-Z0-9_.-]/.test(sourceName))
										{
											// Replace common special characters and wrap in quotes
											const urlEncoded = sourceName
												.replace(/\//g, '%2F')
												.replace(/:/g, '%3A')
												.replace(/\s/g, '%20');
											encodedSource = `"${urlEncoded}"`;
										}
										else
										{
											encodedSource = sourceName;
										}
										
										// Build the new query by appending the source filter to existing conditions
										let newQuery;
										if (existingQuery.startsWith('and('))
										{
											// If already an 'and' query, append to it
											newQuery = existingQuery.slice(0, -1) + `,eq(isolation_source,${encodedSource}))`;
										}
										else
										{
											// Wrap existing query with the new condition in an 'and'
											newQuery = `and(${existingQuery},eq(isolation_source,${encodedSource}))`;
										}
										
										// Navigate to the genome list view with the combined filter
										Topic.publish('/navigate', {
											href: `/view/GenomeList/?${newQuery}#view_tab=genomes`
										});
									}
								}));
							}
							chart.hideLoading();

							setTimeout(() =>
							{
								if (chart.resize)
								{
									chart.resize();
								}
							}, 50);
						}),
						lang.hitch(this, function ()
						{
							chart.hideLoading();
						})
					);

					this.charts.push(chart);
				})
			);
		},

		createMapChart: function ()
		{
			if (!this.mapChartNode || !this.state || !this.state.search) return;

			this._createChartWhenReady(
				this.mapChartNode,
				Choropleth,
				{
					title: "Genome Distribution",
					theme: "maage-echarts-theme",
					externalControlsContainer: this.mapControlsContainer
				},
				lang.hitch(this, function (chart)
				{
					const baseQuery = this.state.search;
					const queryOptions = { headers: { Accept: "application/solr+json" } };

					const countryQuery = `${baseQuery}&facet((field,isolation_country),(mincount,1))&limit(0)`;
					const countryPivotQuery = `${baseQuery}&facet((pivot,(isolation_country,genus)),(mincount,1))&limit(0)`;
					const countryHostQuery = `${baseQuery}&facet((pivot,(isolation_country,host_common_name)),(mincount,1))&limit(0)`;

					const stateQuery = `${baseQuery}&facet((field,state_province),(mincount,1))&limit(0)`;
					const statePivotQuery = `${baseQuery}&facet((pivot,(state_province,genus)),(mincount,1))&limit(0)`;
					const stateHostQuery = `${baseQuery}&facet((pivot,(state_province,host_common_name)),(mincount,1))&limit(0)`;

					const countyQuery = `${baseQuery}&facet((field,county),(mincount,1),(limit,1000))&limit(0)`;
					const countyPivotQuery = `${baseQuery}&facet((pivot,(county,genus)),(mincount,1),(limit,1000))&limit(0)`;

					Promise.all([
						this.genomeStore.query(countryQuery, queryOptions),
						this.genomeStore.query(countryPivotQuery, queryOptions),
						this.genomeStore.query(countryHostQuery, queryOptions),
						this.genomeStore.query(stateQuery, queryOptions),
						this.genomeStore.query(statePivotQuery, queryOptions),
						this.genomeStore.query(stateHostQuery, queryOptions),
						this.genomeStore.query(countyQuery, queryOptions),
						this.genomeStore.query(countyPivotQuery, queryOptions)
					]).then(
						lang.hitch(this, function ([
							countryRes, countryPivotRes, countryHostRes,
							stateRes, statePivotRes, stateHostRes,
							countyRes, countyPivotRes
						])
						{
							const data = {
								countryData: {},
								countryMetadata: {},
								stateData: {},
								stateMetadata: {},
								countyData: {},
								countyMetadata: {}
							};

							const processPivotData = (pivotData, parentField) =>
							{
								const metadata = {};
								if (pivotData && pivotData.facet_counts && pivotData.facet_counts.facet_pivot)
								{
									const pivotKey = Object.keys(pivotData.facet_counts.facet_pivot)[0];
									const pivots = pivotData.facet_counts.facet_pivot[pivotKey] || [];

									pivots.forEach(item =>
									{
										const location = item.value;
										metadata[location] = {
											total: item.count,
											breakdown: {}
										};

										if (item.pivot)
										{
											item.pivot.forEach(subItem =>
											{
												metadata[location].breakdown[subItem.value] = subItem.count;
											});
										}
									});
								}
								return metadata;
							};

							if (countryRes && countryRes.facet_counts && countryRes.facet_counts.facet_fields.isolation_country)
							{
								const facets = countryRes.facet_counts.facet_fields.isolation_country;
								for (let i = 0; i < facets.length; i += 2)
								{
									const name = facets[i];
									const count = facets[i + 1];
									if (name && count > 0)
									{
										data.countryData[name] = count;
									}
								}
							}

							const countryGenusData = processPivotData(countryPivotRes, "isolation_country");
							const countryHostData = processPivotData(countryHostRes, "isolation_country");

							Object.keys(data.countryData).forEach(country =>
							{
								data.countryMetadata[country] = {
								genera: (countryGenusData[country] && countryGenusData[country].breakdown) || {},
								hosts: (countryHostData[country] && countryHostData[country].breakdown) || {}
								};
							});

							if (stateRes && stateRes.facet_counts && stateRes.facet_counts.facet_fields.state_province)
							{
								const facets = stateRes.facet_counts.facet_fields.state_province;
								for (let i = 0; i < facets.length; i += 2)
								{
									const name = facets[i];
									const count = facets[i + 1];
									if (name && count > 0)
									{
										data.stateData[name] = count;
									}
								}
							}

							const stateGenusData = processPivotData(statePivotRes, "state_province");
							const stateHostData = processPivotData(stateHostRes, "state_province");

							Object.keys(data.stateData).forEach(state =>
							{
								data.stateMetadata[state] = {
								genera: (stateGenusData[state] && stateGenusData[state].breakdown) || {},
								hosts: (stateHostData[state] && stateHostData[state].breakdown) || {}
								};
							});

							if (countyRes && countyRes.facet_counts && countyRes.facet_counts.facet_fields.county)
							{
								const facets = countyRes.facet_counts.facet_fields.county;
								for (let i = 0; i < facets.length; i += 2)
								{
									const name = facets[i];
									const count = facets[i + 1];
									if (name && count > 0)
									{
										data.countyData[name] = count;
									}
								}
							}

							const countyGenusData = processPivotData(countyPivotRes, "county");

							Object.keys(data.countyData).forEach(county =>
							{
								data.countyMetadata[county] = {
									genera: (countyGenusData[county] && countyGenusData[county].breakdown) || {}
								};
							});

							console.log("Map data loaded:", data);
							chart.updateChart(data);
							chart.hideLoading();

							setTimeout(() =>
							{
								if (chart.resize)
								{
									chart.resize();
								}
							}, 50);
						}),
						lang.hitch(this, function (err)
						{
							console.error("Failed to load map data:", err);
							chart.hideLoading();
						})
					);

					this.mapChart = chart;
				})
			);
		},

		createYearlyCountChart: function ()
		{
			if (!this.yearlyCountChartNode) return;

			this._createChartWhenReady(
				this.yearlyCountChartNode,
				VerticalBar,
				{
					title: "",
					theme: "maage-echarts-theme"
				},
				lang.hitch(this, function (chart)
				{

					const query = `${this.state.search}&facet((field,collection_year),(mincount,1))&limit(0)`;
					const queryOptions = { headers: { Accept: "application/solr+json" } };

					this.genomeStore.query(query, queryOptions).then(
						lang.hitch(this, function (res)
						{
							if (res && res.facet_counts && res.facet_counts.facet_fields.collection_year)
							{
								const yearFacets = res.facet_counts.facet_fields.collection_year;
								const chartData = [];

								for (let i = 0; i < yearFacets.length; i += 2)
								{
									const year = parseInt(yearFacets[i], 10);
									const count = yearFacets[i + 1];
									if (!isNaN(year) && count > 0)
									{
										chartData.push({
											name: year.toString(),
											value: count
										});
									}
								}

								chartData.sort((a, b) => parseInt(a.name) - parseInt(b.name));

								chart.updateChart(chartData);

								// Add click handler for chart bars
								chart.chart.on('click', lang.hitch(this, function (params)
								{
									if (params.componentType === 'series')
									{
										const year = params.name;
										
										// Get the existing search query and preserve it
										let existingQuery = this.state.search;
										
										// Build the new query by appending the collection year filter to existing conditions
										let newQuery;
										if (existingQuery.startsWith('and('))
										{
											// If already an 'and' query, append to it
											newQuery = existingQuery.slice(0, -1) + `,eq(collection_year,${year}))`;
										}
										else
										{
											// Wrap existing query with the new condition in an 'and'
											newQuery = `and(${existingQuery},eq(collection_year,${year}))`;
										}
										
										// Navigate to the genome list view with the combined filter
										Topic.publish('/navigate', {
											href: `/view/GenomeList/?${newQuery}#view_tab=genomes`
										});
									}
								}));
							}
							chart.hideLoading();

							setTimeout(() =>
							{
								if (chart.resize)
								{
									chart.resize();
								}
							}, 50);
						}),
						lang.hitch(this, function (err)
						{
							console.error("Failed to load yearly genome data:", err);
							chart.hideLoading();
						})
					);
				})
			);
		},

		createAMRChart: function ()
		{
			if (!this.amrChartNode || !this.state || !this.state.search) return;

			if (this.amrChart)
			{
				this.amrChart.destroy();
				this.amrChart = null;
			}

			this._createChartWhenReady(
				this.amrChartNode,
				AMRStackedBar,
				{
					title: "",
					theme: "maage-echarts-theme"
				},
				lang.hitch(this, function (chart)
				{

					const baseQuery = this.state.search;
					const amrQuery = `${baseQuery}&facet((pivot,(antibiotic,resistant_phenotype,genome_id)),(mincount,1),(limit,-1))&json(nl,map)&limit(1)`;
					const queryOptions = { headers: { Accept: "application/solr+json" } };

					this.genomeStore.query(baseQuery + "&select(genome_id)&limit(25000)", queryOptions).then(
						lang.hitch(this, function (genomeRes)
						{
							if (!genomeRes || !genomeRes.response || !genomeRes.response.docs)
							{
								chart.hideLoading();
								return;
							}

							const genomeIds = genomeRes.response.docs.map(d => d.genome_id);
							if (genomeIds.length === 0)
							{
								chart.hideLoading();
								return;
							}

							const amrQuery = `in(genome_id,(${genomeIds.join(",")}))`
								+ "&in(resistant_phenotype,(Resistant,Susceptible,Intermediate))"
								+ "&facet((pivot,(antibiotic,resistant_phenotype)),(mincount,1),(limit,-1))&json(nl,map)&limit(1)";

							this.amrStore.query(amrQuery, queryOptions).then(
								lang.hitch(this, function (res)
								{
									if (res && res.facet_counts && res.facet_counts.facet_pivot)
									{
										chart.updateChart(res.facet_counts);
										
										// Add click handler for chart bars
										chart.chart.on('click', lang.hitch(this, function (params)
										{
											if (params.componentType === 'series')
											{
												const antibiotic = params.name;
												const resistantPhenotype = params.seriesName;
												
												// Get the existing search query and preserve it
												let existingQuery = this.state.search;
												
												// URL encode the antibiotic name - wrap in quotes and encode
												const encodedAntibiotic = encodeURIComponent(`"${antibiotic.toLowerCase()}"`);
												const encodedPhenotype = encodeURIComponent(`"${resistantPhenotype}"`);
												
												// Build the filter string
												const filterString = `and(eq(antibiotic,${encodedAntibiotic}),eq(resistant_phenotype,${encodedPhenotype}))`;
												
												// Navigate to the genome list view with AMR phenotypes tab and filters
												Topic.publish('/navigate', {
													href: `/view/GenomeList/?${existingQuery}#view_tab=amr&filter=${filterString}`
												});
											}
										}));
									}
									chart.hideLoading();
								}),
								lang.hitch(this, function (err)
								{
									console.error("Failed to load AMR data:", err);
									chart.hideLoading();
								})
							);
						}),
						lang.hitch(this, function (err)
						{
							console.error("Failed to load genome data for AMR:", err);
							chart.hideLoading();
						})
					);

					this.amrChart = chart;
				})
			);
		},

		resize: function ()
		{
			this.inherited(arguments);
			if (this.charts) this.charts.forEach((c) => c.resize());
			if (this.amrChart) this.amrChart.resize();
			if (this.mapChart) this.mapChart.resize();
			if (this.sequencingCentersChart) this.sequencingCentersChart.resize();
		},

		createSummaryWidget: function ()
		{
			if (!this.summaryNode || !this.state || !this.state.search) return;

			if (this.summaryWidget)
			{
				this.summaryWidget.destroy();
			}

			this.summaryWidget = new GenomeListSummary({
				state: this.state
			});

			this.summaryWidget.placeAt(this.summaryNode);
			this.summaryWidget.startup();
		},

		destroy: function ()
		{
			this.inherited(arguments);
			if (this.charts) this.charts.forEach((c) => c.destroy());
			if (this.amrChart)
			{
				this.amrChart.destroy();
				this.amrChart = null;
			}
			if (this.mapChart)
			{
				this.mapChart.destroy();
				this.mapChart = null;
			}
			if (this.sequencingCentersChart)
			{
				this.sequencingCentersChart.destroy();
				this.sequencingCentersChart = null;
			}
			if (this.taxonomyChart)
			{
				this.taxonomyChart.destroy();
				this.taxonomyChart = null;
			}
			if (this.summaryWidget)
			{
				this.summaryWidget.destroy();
				this.summaryWidget = null;
			}
		},
	});
});


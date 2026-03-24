define([
	"dojo/_base/declare",
	"dijit/_WidgetBase",
	"dijit/_TemplatedMixin",
	"dojo/_base/lang",
	"dojo/request",
	"dojo/dom-construct",
	"dojo/on"
], function (declare, WidgetBase, TemplatedMixin, lang, request, domConstruct, on)
{

	return declare([WidgetBase, TemplatedMixin], {
		baseClass: "D3Choropleth",
		templateString: "<div></div>",
		title: "",

		worldMapData: null,
		usMapData: null,

		currentView: "us",
		selectedState: null,
		selectedStateName: null,

		controlsNode: null,
		externalControlsContainer: null,
		mapContainer: null,
		svg: null,
		g: null,
		tooltip: null,

		projection: null,
		path: null,
		colorScale: null,

		genomeData: null,
		metadata: null,

		stateNameToFips: {
			"Alabama": "01", "Alaska": "02", "Arizona": "04", "Arkansas": "05",
			"California": "06", "Colorado": "08", "Connecticut": "09", "Delaware": "10",
			"District of Columbia": "11", "Florida": "12", "Georgia": "13", "Hawaii": "15",
			"Idaho": "16", "Illinois": "17", "Indiana": "18", "Iowa": "19",
			"Kansas": "20", "Kentucky": "21", "Louisiana": "22", "Maine": "23",
			"Maryland": "24", "Massachusetts": "25", "Michigan": "26", "Minnesota": "27",
			"Mississippi": "28", "Missouri": "29", "Montana": "30", "Nebraska": "31",
			"Nevada": "32", "New Hampshire": "33", "New Jersey": "34", "New Mexico": "35",
			"New York": "36", "North Carolina": "37", "North Dakota": "38", "Ohio": "39",
			"Oklahoma": "40", "Oregon": "41", "Pennsylvania": "42", "Rhode Island": "44",
			"South Carolina": "45", "South Dakota": "46", "Tennessee": "47", "Texas": "48",
			"Utah": "49", "Vermont": "50", "Virginia": "51", "Washington": "53",
			"West Virginia": "54", "Wisconsin": "55", "Wyoming": "56"
		},

		countryNameMapping: {

			"United States of America": ["USA", "United States", "US"],
			"Canada": ["CAN", "Canada"],
			"Mexico": ["MEX", "Mexico"],

			"United Kingdom": ["United Kingdom", "UK", "GBR", "Great Britain"],
			"Germany": ["Germany", "DEU"],
			"France": ["France", "FRA"],
			"Italy": ["Italy", "ITA"],
			"Spain": ["Spain", "ESP"],
			"Netherlands": ["Netherlands", "NLD", "Holland"],
			"Belgium": ["Belgium", "BEL"],
			"Switzerland": ["Switzerland", "CHE"],
			"Austria": ["Austria", "AUT"],
			"Denmark": ["Denmark", "DNK"],
			"Sweden": ["Sweden", "SWE"],
			"Norway": ["Norway", "NOR"],
			"Finland": ["Finland", "FIN"],
			"Poland": ["Poland", "POL"],
			"Czech Republic": ["Czech Republic", "CZE", "Czechia"],
			"Portugal": ["Portugal", "PRT"],
			"Greece": ["Greece", "GRC"],
			"Ireland": ["Ireland", "IRL"],
			"Hungary": ["Hungary", "HUN"],
			"Romania": ["Romania", "ROU"],

			"China": ["China", "CHN", "People's Republic of China"],
			"Japan": ["Japan", "JPN"],
			"India": ["India", "IND"],
			"South Korea": ["South Korea", "KOR", "Korea, South", "Republic of Korea"],
			"Thailand": ["Thailand", "THA"],
			"Vietnam": ["Vietnam", "VNM", "Viet Nam"],
			"Singapore": ["Singapore", "SGP"],
			"Malaysia": ["Malaysia", "MYS"],
			"Indonesia": ["Indonesia", "IDN"],
			"Philippines": ["Philippines", "PHL"],
			"Bangladesh": ["Bangladesh", "BGD"],
			"Pakistan": ["Pakistan", "PAK"],
			"Turkey": ["Turkey", "TUR"],
			"Israel": ["Israel", "ISR"],
			"Saudi Arabia": ["Saudi Arabia", "SAU"],
			"United Arab Emirates": ["United Arab Emirates", "UAE"],

			"Brazil": ["Brazil", "BRA"],
			"Argentina": ["Argentina", "ARG"],
			"Chile": ["Chile", "CHL"],
			"Peru": ["Peru", "PER"],
			"Colombia": ["Colombia", "COL"],
			"Venezuela": ["Venezuela", "VEN"],
			"Ecuador": ["Ecuador", "ECU"],

			"South Africa": ["South Africa", "ZAF"],
			"Nigeria": ["Nigeria", "NGA"],
			"Egypt": ["Egypt", "EGY"],
			"Kenya": ["Kenya", "KEN"],
			"Ethiopia": ["Ethiopia", "ETH"],
			"Ghana": ["Ghana", "GHA"],
			"Morocco": ["Morocco", "MAR"],

			"Australia": ["Australia", "AUS"],
			"New Zealand": ["New Zealand", "NZL"],

			"Russia": ["Russia", "RUS", "Russian Federation"]
		},

		postCreate: function ()
		{
			this.inherited(arguments);
			this._setupDOM();
			this._setupColorScale();
			this._loadDependencies();
		},

		showLoading: function ()
		{

			if (this.loadingIndicator)
			{
				this.loadingIndicator.style.display = "block";
			}
		},

		hideLoading: function ()
		{

			if (this.loadingIndicator)
			{
				this.loadingIndicator.style.display = "none";
			}
		},

		_loadDependencies: function ()
		{

			require(["d3v7", "topojson-client"], lang.hitch(this, function (d3, topojson)
			{

				this.d3 = d3;
				this.topojson = topojson;

				this.loadMapData();
			}));
		},

		startup: function ()
		{
			this.inherited(arguments);
			if (this.genomeData)
			{
				this.updateChart(this.genomeData);
			}
		},

		_setupDOM: function ()
		{

			this.domNode.style.cssText = "display: flex; flex-direction: column; height: 100%; min-height: 450px;";

			if (this.externalControlsContainer)
			{
				this.controlsNode = this.externalControlsContainer;

				this.controlsNode.innerHTML = "";
			} else
			{

				this.controlsNode = domConstruct.create("div", {
					style: "display: flex; justify-content: space-between; align-items: center; padding: 12px; background-color: #f8f9fa; border-bottom: 1px solid #e9ecef;"
				}, this.domNode);
			}

			const toggleBtnContainer = domConstruct.create("div", {
				className: this.externalControlsContainer ? "flex gap-0.5 bg-gray-100 rounded-md p-0.5" : "",
				style: this.externalControlsContainer ? "" : "display: flex; gap: 8px;"
			}, this.controlsNode);

			this.worldViewBtn = domConstruct.create("button", {
				innerHTML: "World",
				className: this.externalControlsContainer ? "map-view-btn px-2 py-0.5 text-xs font-medium rounded transition-colors" : "",
				style: this.externalControlsContainer ? "" : "padding: 6px 16px; background-color: #6c757d; color: white; border-radius: 6px; border: none; cursor: pointer; font-size: 15px; font-weight: 500; transition: background-color 0.2s;"
			}, toggleBtnContainer);

			this.usViewBtn = domConstruct.create("button", {
				innerHTML: "United States",
				className: this.externalControlsContainer ? "map-view-btn px-2 py-0.5 text-xs font-medium rounded transition-colors active" : "",
				style: this.externalControlsContainer ? "" : "padding: 6px 16px; background-color: #98bdac; color: white; border-radius: 6px; border: none; cursor: pointer; font-size: 15px; font-weight: 500; transition: background-color 0.2s;"
			}, toggleBtnContainer);

			this.stateViewBtn = domConstruct.create("button", {
				innerHTML: "State",
				className: this.externalControlsContainer ? "map-view-btn px-2 py-0.5 text-xs font-medium rounded transition-colors" : "",
				style: this.externalControlsContainer ? "" : "padding: 6px 16px; background-color: #6c757d; color: white; border-radius: 6px; border: none; cursor: pointer; font-size: 15px; font-weight: 500; transition: background-color 0.2s;"
			}, toggleBtnContainer);

			this.viewIndicatorNode = domConstruct.create("div", {
				className: this.externalControlsContainer ? "ml-3 px-3 py-1 bg-maage-primary-50 text-maage-primary-700 rounded-md text-sm font-medium" : "",
				style: this.externalControlsContainer ? "display: none;" : "display: none; margin-left: 12px; padding: 6px 16px; background-color: #ecf3f0; color: #496f5d; border-radius: 6px; font-size: 14px; font-weight: 500;",
				innerHTML: "Viewing: United States"
			}, this.controlsNode);

			this.stateDropdownNode = domConstruct.create("select", {
				className: this.externalControlsContainer ? "px-2 py-0.5 text-xs font-medium border border-gray-300 rounded-md bg-white" : "",
				style: this.externalControlsContainer ? "" : "padding: 6px 16px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 15px; cursor: pointer; background-color: white;"
			}, this.controlsNode);

			domConstruct.create("option", {
				value: "",
				innerHTML: "Select a state...",
				selected: false
			}, this.stateDropdownNode);

			Object.keys(this.stateNameToFips).forEach(lang.hitch(this, function (stateName)
			{
				const option = domConstruct.create("option", {
					value: this.stateNameToFips[stateName],
					innerHTML: stateName
				}, this.stateDropdownNode);

				if (stateName === "Illinois")
				{
					option.selected = true;
					this.selectedState = this.stateNameToFips[stateName];
					this.selectedStateName = stateName;
				}
			}));

			this.backButtonNode = domConstruct.create("button", {
				className: this.externalControlsContainer ? "px-2 py-0.5 text-xs font-medium rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors" : "",
				style: this.externalControlsContainer ? "display: none;" : "padding: 6px 16px; background-color: #5f94ab; color: white; border-radius: 6px; border: none; cursor: pointer; font-size: 15px; font-weight: 500; display: none;",
				innerHTML: "← Back"
			}, this.controlsNode);

			const zoomControls = domConstruct.create("div", {
				className: this.externalControlsContainer ? "flex gap-0.5 bg-gray-100 rounded-md p-0.5" : "",
				style: this.externalControlsContainer ? "" : "display: flex; gap: 6px; background-color: #f3f4f6; border-radius: 10px; padding: 6px;"
			}, this.controlsNode);

			this.zoomInBtn = domConstruct.create("button", {
				innerHTML: "+",
				className: this.externalControlsContainer ? "map-zoom-btn px-2 py-1 text-sm font-bold rounded transition-colors" : "",
				style: this.externalControlsContainer ? "" : "width: 40px; height: 40px; background-color: #98bdac; color: white; border-radius: 8px; border: none; cursor: pointer; font-size: 24px; font-weight: bold;"
			}, zoomControls);

			this.zoomOutBtn = domConstruct.create("button", {
				innerHTML: "−",
				className: this.externalControlsContainer ? "map-zoom-btn px-2 py-1 text-sm font-bold rounded transition-colors" : "",
				style: this.externalControlsContainer ? "" : "width: 40px; height: 40px; background-color: #5f94ab; color: white; border-radius: 8px; border: none; cursor: pointer; font-size: 24px; font-weight: bold;"
			}, zoomControls);

			this.zoomResetBtn = domConstruct.create("button", {
				innerHTML: "⟲",
				className: this.externalControlsContainer ? "map-zoom-btn px-2 py-1 text-sm font-bold rounded transition-colors" : "",
				style: this.externalControlsContainer ? "" : "width: 40px; height: 40px; background-color: #6c757d; color: white; border-radius: 8px; border: none; cursor: pointer; font-size: 24px; font-weight: bold;"
			}, zoomControls);

			if (this.externalControlsContainer)
			{
				this.mapContainer = this.domNode;
				this.mapContainer.style.cssText = "position: relative; overflow: hidden; height: 100%;";
			} else
			{
				this.mapContainer = domConstruct.create("div", {
					style: "flex: 1; position: relative; overflow: hidden;"
				}, this.domNode);
			}

			this.loadingIndicator = domConstruct.create("div", {
				style: "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); " +
					"background: rgba(255, 255, 255, 0.9); padding: 20px; border-radius: 8px; " +
					"box-shadow: 0 2px 10px rgba(0,0,0,0.1); font-size: 14px; color: #333; display: none;",
				innerHTML: '<div style="text-align: center;">Loading map data...</div>'
			}, this.mapContainer);

			this.mapTitleNode = domConstruct.create("div", {
				style: "position: absolute; top: 20px; left: 20px; background: rgba(255, 255, 255, 0.95); " +
					"padding: 10px 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); " +
					"font-size: 18px; font-weight: 600; color: #496f5d; border: 2px solid #98bdac;",
				innerHTML: "United States"
			}, this.mapContainer);

			this.legendNode = domConstruct.create("div", {
				style: "position: absolute; bottom: 20px; right: 20px; background: rgba(255, 255, 255, 0.95); " +
					"padding: 12px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); " +
					"font-size: 12px; color: #333; display: none;"
			}, this.mapContainer);

			this._setupEventHandlers();
		},

		_setupEventHandlers: function ()
		{
			on(this.worldViewBtn, "click", lang.hitch(this, "switchToWorldView"));
			on(this.usViewBtn, "click", lang.hitch(this, "switchToUSView"));
			on(this.stateViewBtn, "click", lang.hitch(this, function ()
			{

				if (this.selectedState && this.selectedStateName)
				{
					this.switchToStateView(this.selectedState, this.selectedStateName);
				} else
				{

					this.switchToStateView("17", "Illinois");
				}
			}));
			on(this.stateDropdownNode, "change", lang.hitch(this, function (evt)
			{
				const stateCode = evt.target.value;
				if (stateCode)
				{
					const stateName = this._getStateNameByCode(stateCode);
					if (stateName)
					{
						this.switchToStateView(stateCode, stateName);
					}
				}
			}));
			on(this.backButtonNode, "click", lang.hitch(this, function ()
			{
				if (this.currentView !== "world" && this.currentView !== "us")
				{
					this.switchToUSView();
				}
			}));
			on(this.zoomInBtn, "click", lang.hitch(this, "zoomIn"));
			on(this.zoomOutBtn, "click", lang.hitch(this, "zoomOut"));
			on(this.zoomResetBtn, "click", lang.hitch(this, "resetZoom"));
		},

		_setupColorScale: function (maxValue)
		{

			if (this.d3)
			{

				this.colorScale = this.d3.scaleSequential()
					.domain([0, Math.log10(maxValue + 1)])
					.interpolator(this.d3.interpolateRgb("#f0f9f0", "#2d6a4f"))
					.clamp(true);

				this._originalColorScale = this.colorScale;
				this.colorScale = (value) =>
				{
					if (value === 0) return "#f8f9fa";
					return this._originalColorScale(Math.log10(value + 1));
				};
			}
		},

		_setupSVG: function ()
		{
			if (!this.d3) return;

			if (this.svg)
			{
				this.svg.remove();
			}

			const containerRect = this.mapContainer.getBoundingClientRect();
			const width = containerRect.width || 800;
			const height = containerRect.height || 450;

			this.svg = this.d3.select(this.mapContainer)
				.append("svg")
				.attr("width", width)
				.attr("height", height)
				.style("display", "block");

			this.g = this.svg.append("g");

			const zoom = this.d3.zoom()
				.scaleExtent([0.5, 8])
				.on("zoom", (event) =>
				{
					this.g.attr("transform", event.transform);
				});

			this.svg.call(zoom);
			this.zoomBehavior = zoom;

			if (this.tooltip)
			{
				this.tooltip.remove();
			}

			this.tooltip = this.d3.select(this.mapContainer)
				.append("div")
				.style("position", "absolute")
				.style("background", "rgba(15, 23, 42, 0.95)")
				.style("color", "white")
				.style("padding", "12px")
				.style("border-radius", "6px")
				.style("font-size", "13px")
				.style("pointer-events", "none")
				.style("opacity", 0)
				.style("box-shadow", "0 4px 6px rgba(0, 0, 0, 0.1)")
				.style("border", "1px solid rgba(255, 255, 255, 0.1)");
		},

		loadMapData: function ()
		{
			if (!this.d3 || !this.topojson)
			{
				console.warn("D3 or topojson not available");
				return;
			}

			this.showLoading();

			const promises = [
				request("/maage/maps/world-atlas/countries-110m.json", { handleAs: "json" }),
				request("/maage/maps/us-atlas/counties-10m.json", { handleAs: "json" })
			];

			Promise.all(promises).then(
				lang.hitch(this, function ([worldTopo, usAtlas])
				{
					this.worldMapData = worldTopo;
					this.usMapData = usAtlas;

					this._setupSVG();
					this.hideLoading();

					if (this.genomeData)
					{
						this.updateChart(this.genomeData);
					} else
					{
						this.switchToUSView();
					}
				}),
				lang.hitch(this, function (err)
				{
					console.error("Failed to load map data:", err);
					this.hideLoading();
				})
			);
		},

		updateChart: function (data)
		{
			this.genomeData = data;

			console.log("D3Choropleth updateChart called with data:", data);

			if (!this.worldMapData || !this.usMapData || !this.svg)
			{
				console.log("D3Choropleth: Missing required resources", {
					worldMapData: !!this.worldMapData,
					usMapData: !!this.usMapData,
					svg: !!this.svg
				});
				return;
			}

			let maxValue = 0;
			if (data)
			{
				const allCounts = [
					...Object.values(data.countryData || {}),
					...Object.values(data.stateData || {}),
					...Object.values(data.countyData || {})
				];
				maxValue = Math.max(...allCounts, 0);
				console.log("D3Choropleth: Max value for color scale:", maxValue);
			}

			this._setupColorScale(maxValue);
			this._updateLegend(maxValue);

			if (this.currentView === "world")
			{
				this.drawWorldView();
			} else if (this.currentView === "us")
			{
				this.drawUSView();
			} else
			{
				this.drawStateView(this.selectedState, this.selectedStateName);
			}
		},

		switchToWorldView: function ()
		{
			this.currentView = "world";

			if (this.stateDropdownNode)
			{
				this.stateDropdownNode.value = "";
			}
			this._updateButtonStyles();
			this.drawWorldView();
		},

		switchToUSView: function ()
		{
			this.currentView = "us";
			this.selectedState = null;
			this.selectedStateName = null;

			if (this.stateDropdownNode)
			{
				this.stateDropdownNode.value = "";
			}
			this._updateButtonStyles();
			this.drawUSView();
		},

		switchToStateView: function (stateCode, stateName)
		{
			this.currentView = "state";
			this.selectedState = stateCode;
			this.selectedStateName = stateName;

			if (this.stateDropdownNode)
			{
				this.stateDropdownNode.value = stateCode;
			}
			this._updateButtonStyles();
			this.drawStateView(stateCode, stateName);
		},

		drawWorldView: function ()
		{
			if (!this.d3 || !this.topojson || !this.worldMapData) return;

			this.g.selectAll("*").remove();

			const containerRect = this.mapContainer.getBoundingClientRect();
			const width = containerRect.width || 800;
			const height = containerRect.height || 450;

			this.projection = this.d3.geoNaturalEarth1()
				.scale(150)
				.translate([width / 2, height / 2]);

			this.path = this.d3.geoPath().projection(this.projection);

			const countries = this.topojson.feature(this.worldMapData, this.worldMapData.objects.countries);

			this.g.selectAll(".country")
				.data(countries.features)
				.join("path")
				.attr("class", "country")
				.attr("d", this.path)
				.attr("fill", (d) =>
				{
					const countryData = this._getCountryData(d);
					return countryData ? this.colorScale(countryData.value) : "#f8f9fa";
				})
				.attr("stroke", "#334155")
				.attr("stroke-width", 0.5)
				.style("cursor", "pointer")
				.on("mouseover", (event, d) => this._showTooltip(event, d, "country"))
				.on("mouseout", () => this._hideTooltip())
				.on("click", (event, d) =>
				{

					const countryName = d.properties.NAME || d.properties.name || d.properties.ADMIN || d.properties.admin || "";

					const usaNames = ["United States of America", "United States", "USA", "US"];
					if (usaNames.some(name => countryName === name || countryName.includes("United States")))
					{
						this.switchToUSView();
					}
				});

			this.resetZoom();
		},

		drawUSView: function ()
		{
			if (!this.d3 || !this.topojson || !this.usMapData) return;

			this.g.selectAll("*").remove();

			const containerRect = this.mapContainer.getBoundingClientRect();
			const width = containerRect.width || 800;
			const height = containerRect.height || 450;

			this.projection = this.d3.geoAlbersUsa()
				.scale(1000)
				.translate([width / 2, height / 2]);

			this.path = this.d3.geoPath().projection(this.projection);

			const states = this.topojson.feature(this.usMapData, this.usMapData.objects.states);

			this.g.selectAll(".state")
				.data(states.features)
				.join("path")
				.attr("class", "state")
				.attr("d", this.path)
				.attr("fill", (d) =>
				{
					const stateData = this._getStateData(d);
					return stateData ? this.colorScale(stateData.value) : "#f8f9fa";
				})
				.attr("stroke", "#334155")
				.attr("stroke-width", 0.5)
				.style("cursor", "pointer")
				.on("mouseover", (event, d) => this._showTooltip(event, d, "state"))
				.on("mouseout", () => this._hideTooltip())
				.on("click", (event, d) =>
				{
					const stateCode = d.id;
					const stateName = d.properties.name;
					if (stateCode && stateName)
					{
						this.switchToStateView(stateCode, stateName);
					}
				});

			this.g.append("path")
				.datum(this.topojson.mesh(this.usMapData, this.usMapData.objects.states, (a, b) => a !== b))
				.attr("fill", "none")
				.attr("stroke", "#e2e8f0")
				.attr("stroke-linejoin", "round")
				.attr("d", this.path);

			this.resetZoom();
		},

		drawStateView: function (stateCode, stateName)
		{
			if (!this.d3 || !this.topojson || !this.usMapData) return;

			this.g.selectAll("*").remove();

			const containerRect = this.mapContainer.getBoundingClientRect();
			const width = containerRect.width || 800;
			const height = containerRect.height || 450;

			const allCounties = this.topojson.feature(this.usMapData, this.usMapData.objects.counties);
			const stateCounties = allCounties.features.filter(d => d.id.startsWith(stateCode));

			if (stateCounties.length === 0)
			{
				console.warn("No county data for state:", stateName);
				this.switchToUSView();
				return;
			}

			const stateBounds = { type: "FeatureCollection", features: stateCounties };

			this.projection = this.d3.geoMercator();
			const padding = 20;
			this.projection.fitExtent(
				[[padding, padding], [width - padding, height - padding]],
				stateBounds
			);

			this.path = this.d3.geoPath().projection(this.projection);

			this.g.selectAll(".county")
				.data(stateCounties)
				.join("path")
				.attr("class", "county")
				.attr("d", this.path)
				.attr("fill", (d) =>
				{
					const countyData = this._getCountyData(d);
					return countyData ? this.colorScale(countyData.value) : "#f8f9fa";
				})
				.attr("stroke", "#334155")
				.attr("stroke-width", 0.5)
				.style("cursor", "pointer")
				.on("mouseover", (event, d) => this._showTooltip(event, d, "county"))
				.on("mouseout", () => this._hideTooltip());

			this.g.append("path")
				.datum(this.topojson.mesh(this.usMapData, this.usMapData.objects.counties,
					(a, b) => a !== b && a.id.slice(0, 2) === stateCode && b.id.slice(0, 2) === stateCode))
				.attr("fill", "none")
				.attr("stroke", "#e2e8f0")
				.attr("stroke-linejoin", "round")
				.attr("stroke-width", 0.25)
				.attr("d", this.path);

			this.resetZoom();
		},

		_showTooltip: function (event, d, type)
		{
			let data, content, displayName;

			if (!this._debuggedTooltip)
			{
				console.log("D3Choropleth: Tooltip debug", {
					type: type,
					properties: d.properties,
					id: d.id
				});
				this._debuggedTooltip = true;
			}

			if (type === "country")
			{
				data = this._getCountryData(d);

				displayName = d.properties.NAME || d.properties.name || d.properties.ADMIN || d.properties.admin || "Unknown";
				content = `<div><strong>${displayName}</strong></div>`;
			} else if (type === "state")
			{
				data = this._getStateData(d);

				displayName = d.properties.name || d.properties.NAME || d.properties.STATE_NAME || "Unknown";
				content = `<div><strong>${displayName}</strong></div>`;
			} else
			{
				data = this._getCountyData(d);

				displayName = d.properties.name || d.properties.NAME || d.properties.COUNTY || "Unknown";
				content = `<div><strong>${displayName}</strong></div>`;
			}

			if (data)
			{
				content += `<div>Genomes: ${data.count || 0}</div>`;
				if (data.genera && data.genera.length > 0)
				{
					content += `<div style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px;">`;
					content += `<div style="font-weight: bold; margin-bottom: 4px;">Top Genera:</div>`;
					data.genera.slice(0, 5).forEach(g =>
					{
						content += `<div><em>${g.genus}</em>: ${g.count} (${g.percentage}%)</div>`;
					});
					content += `</div>`;
				}

				if ((type === "country" || type === "state") && data.hosts && data.hosts.length > 0)
				{
					content += `<div style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px;">`;
					content += `<div style="font-weight: bold; margin-bottom: 4px;">Top Hosts:</div>`;
					data.hosts.slice(0, 5).forEach(h =>
					{
						content += `<div>${h.host}: ${h.count} (${h.percentage}%)</div>`;
					});
					content += `</div>`;
				}
			} else
			{
				content += `<div>No data available</div>`;
			}

			const [x, y] = this.d3.pointer(event, this.mapContainer);
			this.tooltip
				.style("opacity", 1)
				.html(content)
				.style("left", (x + 15) + "px")
				.style("top", (y - 15) + "px");
		},

		_hideTooltip: function ()
		{
			this.tooltip.style("opacity", 0);
		},

		_getCountryData: function (feature)
		{
			if (!this.genomeData || !this.genomeData.countryData) return null;

			const props = feature.properties || {};
			const topoJsonName = props.NAME || props.name || props.ADMIN || props.admin || "";

			if (!this._debuggedCountries)
			{
				this._debuggedCountries = 0;
			}
			if (this._debuggedCountries < 5)
			{
				console.log("D3Choropleth: Country lookup", {
					topoJsonName: topoJsonName,
					allProperties: props,
					availableDataKeys: Object.keys(this.genomeData.countryData).slice(0, 10)
				});
				this._debuggedCountries++;
			}

			let count = 0;
			let matchedKey = null;

			if (this.genomeData.countryData[topoJsonName])
			{
				count = this.genomeData.countryData[topoJsonName];
				matchedKey = topoJsonName;
			} else
			{

				const possibleNames = this.countryNameMapping[topoJsonName];
				if (possibleNames)
				{
					for (let i = 0; i < possibleNames.length; i++)
					{
						const name = possibleNames[i];
						if (this.genomeData.countryData[name])
						{
							count = this.genomeData.countryData[name];
							matchedKey = name;
							break;
						}
					}
				}

				if (!count)
				{
					const normalized = topoJsonName.toLowerCase().replace(/[^a-z]/g, "");
					Object.keys(this.genomeData.countryData).forEach(dataKey =>
					{
						const dataNorm = dataKey.toLowerCase().replace(/[^a-z]/g, "");
						if (dataNorm === normalized)
						{
							count = this.genomeData.countryData[dataKey];
							matchedKey = dataKey;
						}
					});
				}
			}

			if (!count) return null;

			const metadata = this.genomeData.countryMetadata && this.genomeData.countryMetadata[matchedKey];

			return {
				count: count,
				value: count,
				genera: this._formatGenera(metadata && metadata.genera),
				hosts: this._formatBreakdown(metadata && metadata.hosts)
			};
		},

		_getStateData: function (feature)
		{
			if (!this.genomeData || !this.genomeData.stateData) return null;

			const props = feature.properties || {};
			const stateName = props.name || props.NAME || "";
			const normalized = stateName.toLowerCase().replace(/[^a-z]/g, "");

			const stateLookup = {};
			Object.keys(this.genomeData.stateData).forEach(state =>
			{
				const norm = state.toLowerCase().replace(/[^a-z]/g, "");
				stateLookup[norm] = this.genomeData.stateData[state];
				stateLookup[state] = this.genomeData.stateData[state];
			});

			if (!this._debuggedFirstState)
			{
				console.log("D3Choropleth: First state lookup", {
					stateName: stateName,
					normalized: normalized,
					availableStates: Object.keys(this.genomeData.stateData).slice(0, 5),
					lookupKeys: Object.keys(stateLookup).slice(0, 10)
				});
				this._debuggedFirstState = true;
			}

			let count = 0;
			if (stateLookup[stateName])
			{
				count = stateLookup[stateName];
			} else if (stateLookup[normalized])
			{
				count = stateLookup[normalized];
			}

			if (!count) return null;

			const metadata = this.genomeData.stateMetadata && this.genomeData.stateMetadata[stateName];

			return {
				count: count,
				value: count,
				genera: this._formatGenera(metadata && metadata.genera),
				hosts: this._formatBreakdown(metadata && metadata.hosts)
			};
		},

		_getCountyData: function (feature)
		{
			if (!this.genomeData || !this.genomeData.countyData) return null;

			const props = feature.properties || {};
			const countyName = props.name || props.NAME || "";
			const normalized = countyName.toLowerCase().replace(/[^a-z]/g, "");

			const countyLookup = {};
			Object.keys(this.genomeData.countyData).forEach(county =>
			{
				const norm = county.toLowerCase().replace(/[^a-z]/g, "");
				countyLookup[norm] = this.genomeData.countyData[county];
				countyLookup[county] = this.genomeData.countyData[county];
			});

			let count = 0;
			if (countyLookup[countyName])
			{
				count = countyLookup[countyName];
			} else if (countyLookup[normalized])
			{
				count = countyLookup[normalized];
			}

			if (!count) return null;

			const metadata = this.genomeData.countyMetadata && this.genomeData.countyMetadata[countyName];

			return {
				count: count,
				value: count,
				genera: this._formatGenera(metadata && metadata.genera)
			};
		},

		_formatGenera: function (genera)
		{
			if (!genera) return [];

			const total = Object.values(genera).reduce((sum, count) => sum + count, 0);
			return Object.entries(genera)
				.map(([genus, count]) => ({
					genus: genus,
					count: count,
					percentage: Math.round((count / total) * 100)
				}))
				.sort((a, b) => b.count - a.count);
		},

		_formatBreakdown: function (breakdown)
		{
			if (!breakdown) return [];

			const total = Object.values(breakdown).reduce((sum, count) => sum + count, 0);
			return Object.entries(breakdown)
				.map(([name, count]) => ({
					name: name,
					count: count,
					percentage: Math.round((count / total) * 100)
				}))
				.sort((a, b) => b.count - a.count);
		},

		_getStateNameByCode: function (code)
		{
			for (const [name, fips] of Object.entries(this.stateNameToFips))
			{
				if (fips === code) return name;
			}
			return null;
		},

		_updateButtonStyles: function ()
		{

			if (this.mapTitleNode)
			{
				if (this.currentView === "world")
				{
					this.mapTitleNode.innerHTML = "World";
				} else if (this.currentView === "us")
				{
					this.mapTitleNode.innerHTML = "United States";
				} else if (this.currentView === "state" && this.selectedStateName)
				{
					this.mapTitleNode.innerHTML = this.selectedStateName;
				}
			}

			if (this.externalControlsContainer)
			{

				[this.worldViewBtn, this.usViewBtn, this.stateViewBtn].forEach(btn =>
				{
					btn.classList.remove("active");
				});

				if (this.currentView === "world")
				{
					this.worldViewBtn.classList.add("active");
					this.stateDropdownNode.style.display = "none";
					this.backButtonNode.style.display = "none";
				} else if (this.currentView === "us")
				{
					this.usViewBtn.classList.add("active");
					this.stateDropdownNode.style.display = "none";
					this.backButtonNode.style.display = "none";
				} else
				{

					this.stateViewBtn.classList.add("active");
					this.stateDropdownNode.style.display = "inline-block";
					this.backButtonNode.style.display = "inline-block";
				}
			} else
			{

				[this.worldViewBtn, this.usViewBtn, this.stateViewBtn].forEach(btn =>
				{
					btn.style.backgroundColor = "#6c757d";
					btn.style.boxShadow = "none";
				});

				if (this.currentView === "world")
				{
					this.worldViewBtn.style.backgroundColor = "#98bdac";
					this.worldViewBtn.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
					this.stateDropdownNode.style.display = "none";
					this.backButtonNode.style.display = "none";
				} else if (this.currentView === "us")
				{
					this.usViewBtn.style.backgroundColor = "#98bdac";
					this.usViewBtn.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
					this.stateDropdownNode.style.display = "none";
					this.backButtonNode.style.display = "none";
				} else
				{

					this.stateViewBtn.style.backgroundColor = "#98bdac";
					this.stateViewBtn.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
					this.stateDropdownNode.style.display = "inline-block";
					this.backButtonNode.style.display = "inline-block";
				}
			}
		},

		_updateLegend: function (maxValue)
		{
			if (!this.legendNode || !this.d3 || !maxValue)
			{
				if (this.legendNode) this.legendNode.style.display = "none";
				return;
			}

			this.legendNode.innerHTML = "";

			const gradientId = "colorGradient" + Math.random().toString(36).substr(2, 9);
			const legendSvg = this.d3.select(this.legendNode)
				.append("svg")
				.attr("width", 200)
				.attr("height", 60);

			const gradient = legendSvg.append("defs")
				.append("linearGradient")
				.attr("id", gradientId)
				.attr("x1", "0%")
				.attr("y1", "0%")
				.attr("x2", "100%")
				.attr("y2", "0%");

			const numStops = 10;
			for (let i = 0; i <= numStops; i++)
			{
				const value = (i / numStops) * maxValue;
				gradient.append("stop")
					.attr("offset", (i / numStops * 100) + "%")
					.attr("stop-color", this.colorScale(value));
			}

			legendSvg.append("rect")
				.attr("x", 10)
				.attr("y", 10)
				.attr("width", 180)
				.attr("height", 20)
				.style("fill", "url(#" + gradientId + ")")
				.style("stroke", "#ccc")
				.style("stroke-width", 1);

			legendSvg.append("text")
				.attr("x", 10)
				.attr("y", 45)
				.style("font-size", "11px")
				.style("fill", "#333")
				.text("0");

			legendSvg.append("text")
				.attr("x", 190)
				.attr("y", 45)
				.style("font-size", "11px")
				.style("fill", "#333")
				.style("text-anchor", "end")
				.text(maxValue.toLocaleString());

			legendSvg.append("text")
				.attr("x", 100)
				.attr("y", 55)
				.style("font-size", "11px")
				.style("fill", "#666")
				.style("text-anchor", "middle")
				.text("Genome Count");

			this.legendNode.style.display = "block";
		},

		zoomIn: function ()
		{
			if (this.zoomBehavior && this.svg)
			{
				this.svg.transition().duration(300).call(
					this.zoomBehavior.scaleBy, 1.5
				);
			}
		},

		zoomOut: function ()
		{
			if (this.zoomBehavior && this.svg)
			{
				this.svg.transition().duration(300).call(
					this.zoomBehavior.scaleBy, 1 / 1.5
				);
			}
		},

		resetZoom: function ()
		{
			if (this.zoomBehavior && this.svg && this.d3)
			{
				this.svg.transition().duration(500).call(
					this.zoomBehavior.transform,
					this.d3.zoomIdentity
				);
			}
		},

		resize: function ()
		{
			if (this.svg && this.mapContainer)
			{
				const containerRect = this.mapContainer.getBoundingClientRect();
				const width = containerRect.width || 800;
				const height = containerRect.height || 450;

				this.svg
					.attr("width", width)
					.attr("height", height);

				this.updateChart(this.genomeData);
			}
		},

		destroy: function ()
		{
			if (this.svg)
			{
				this.svg.remove();
			}
			if (this.tooltip)
			{
				this.tooltip.remove();
			}
			this.inherited(arguments);
		}
	});
});
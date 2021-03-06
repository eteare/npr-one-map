(function(){

  'use strict';

  /**
   * Data model for visualization
   * Data is loaded from an external .csv file
   */
  var Model = {

    dataSrc: 'data/npr-one-station-data.csv'

  };

  /**
   * Controller for the map visualization
   */
  var Controller = {

    data: null, // to be populated with data from external .csv resource

    params: {
      width: 1200,
      height: 900
    },

    /**
     * Initialize the controller
     */
    init: function(){

      this.makeMap();

      // Initialize the views
      View.init();
      NavigationView.init();

      this.loadData();

    },

    loadData: function(){

      var self = this;

      d3.csv( Model.dataSrc , function(error, data) {

        if (error) {
          console.log(error);
        } else {
          self.data = data;
          View.render('cume');
        }

      });

    },

    /**
     * Rerender dots based on whether user has selected TSR or # of products
     * @param {string} type - TSR or products
     */
    render: function(){
      View.render();
    },

    /**
     * Filter which stations should be rendered based on user input.
     * @param {string} str - Name of the filter to apply
     */
    switchFilters: function(str){
      d3.selectAll('.hidden').classed('hidden', false);
      View.filter(str);
    },

    getData: function(){
      return this.data;
    },

    /**
     * Get map projection based on d3.geo module
     * @returns {object} - an instance of d3.geo.albersUsa
     */
    getProjection: function(){
      return this.projection;
    },

    /**
     * Load mapping data and tell view to render map
     */
    makeMap: function(){

      var scale = 1.5; // make map larger than default.

      // set projection
      this.projection = d3.geo.albersUsa();

      this.projection.scale(1000 * scale);
      this.projection.translate([400*scale,250*scale]);

      var path = d3.geo.path().projection(this.projection);

      d3.json("data/us.json", function (error, topology) {
        View.renderMap(topology, path);
      });
    },

  };

  /**
   * Map View with dots representing stations
   */
  var View = {

    tooltip: null,

    max: 100,

    min: 0,

    projection: null,

    /**
     * Create markup for tooltip based on station data
     * @param {obj} d - data object for selected station.
     * @returns {string} markup - Text for the tooltip.
     */
    getTooltipMarkup: function(d){

      var stationType,
          className;

      if (d.newscasts == 0 && d.localstories == 0) {
        stationType = "Does not participate";
        className = "tooltip-neither";
      } else if (d.newscasts == 0 && d.localstories == 1){
        stationType = "Contributes local stories";
        className = "tooltip-local";
      } else if (d.newscasts == 1 && d.localstories == 0){
        stationType = "Contributes newscasts";
        className = "tooltip-newscasts";
      } else {
        stationType = "Contributes both newscasts and local stories";
        className = "tooltip-both";
      }


      var mk =  "<div class='slug classes'>type</div>" +
        "<h3>title</h3>" +
        "<p><span class='cume'>CUME:</span> cumenum</p>" +
        "<img src='imgsrc'>";

      var stationLogo = d.logo;

      if (stationLogo == ''){
        stationLogo = "station_logos/a-default.gif";
      }
      var mapObj = {
        type: stationType,
        classes: className,
        title: d.name,
        imgsrc: "data/" + stationLogo,
        cumenum: d.cume.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
      };

      return mk.replace(/type|classes|title|cumenum|imgsrc/gi, function(matched){
        return mapObj[matched];
      });

    },

    /**
     * Initialize View
     * Create tooltip; append <svg> and <g> to the DOM.
     */
    init: function(){

      // Create tool tip
      this.tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

      this.svg = d3.select("body").append("svg")
          .attr("width", Controller.params.width)
          .attr("height", Controller.params.height);

      this.g = this.svg.append('g')
              .call(d3.behavior.zoom()
                  .scaleExtent([1, 10])
                  .on("zoom", zoom)
              );

      this.projection = Controller.getProjection();
    },

    /**
     * Render the map
     * @param {object} topology - data from US map
     * @param {object} path - outline data based on geo projection (e.g. Albers)
     */
    renderMap: function(topology, path){
       this.g.selectAll("path")
            .data(topojson.feature(topology, topology.objects.states).features)
            .enter().append("path")
            .attr("d", path);
    },

    /**
     * Hide and show station dots based on user interaction
     */
    filter: function(filterText){
      var dots = this.svg.selectAll("circle").data(Controller.getData());
      dots.filter(function(d) {
          if (filterText == "all") {
            // Show all eligible stations as gray dots
            return this;
          } else {
            return null;
          }
        })
        .classed('hidden', true);
    },

    /**
     * Render dots on the map
     * @param {string} type - Render dot size according to TSR or some other property
     */
    render: function(type){

      var self = this;

      var type = type || 'cume';

      var div = this.tooltip,
          _data = Controller.getData();

      var dots = this.svg.selectAll("circle").data(_data);

      var projection = Controller.getProjection();

      var max = d3.max(Controller.getData(), function(d) {
        return Number(d[type]);
      });

      var min = d3.min(Controller.getData(), function(d) {
        return Number(d[type]);
      });

      min = min == 0 ? 8 : min;

      var scale = d3.scale.linear(),
          domain = scale.domain([min, max]),
          range = scale.range([3, 60]);

      dots.enter()
        .append("circle")
        .attr("cx", function (d) {
          if (d.longitude == 0 || d.latitude == 0){
            return projection([-95,40])[0];
          }
          return projection([d.longitude,d.latitude])[0];

        })
        .attr("cy", function (d) {
          if (d.longitude == 0 || d.latitude == 0){
            return projection([-95,40])[1];
          }
          return projection([d.longitude,d.latitude])[1];

        })
        .attr("r", 0)
        .attr("class", function (d){
          var classes = '';
          if (d.newscasts == 0){
            classes += ' no-newscasts';
          } else {
            classes += " yes-newscasts";
          }
          if (d.localstories == 0){
            classes += ' no-local-stories';
          } else {
            classes += ' yes-local-stories';
          }
          return classes;
        })
        // Fill is handled in the css.
        // .attr("fill", function (d) {
        //   return "hsla(0,0%,70%,1)";
        // });

        dots.transition()
          .delay(function(d, i){
              return i*4;
          })
          .ease("bounce")
          .duration(500)
          .attr("r", function(d) {
            if ( d[type] == 0 || d.longitude == 0 || d.latitude == 0){
              return 0;
            }
            return scale(d[type]);
          });

      dots.on("mouseover", function(d){
        var toolTipXOffset = 20,
            toolTipYOffset = 0;

        if ((d3.event.pageX + 260) > window.innerWidth){
          // tooltip will be too far to the right.
          toolTipXOffset = -280;
        }

        if ((d3.event.pageY + 128) > window.innerHeight){
          // tooltip will be too far to the right.
          toolTipYOffset = -128;
        }

        var r = Math.round(this.getAttribute('r')),
            cx = Math.round(this.getAttribute('cx')),
            cy = Math.round(this.getAttribute('cy'));
          d3.select(this).classed('active', true);
          div.transition()
            .duration(200)
            .style("opacity", .9);
          var markup = self.getTooltipMarkup(d);
          div.html(markup)
            .style("left",  (d3.event.pageX) + toolTipXOffset + "px")
            .style("top", (d3.event.pageY) + toolTipYOffset + "px");
        })
        .on("mouseout", function(d){
          d3.select(this).classed('active', false);
          div.transition()
            .duration(200)
            .style("opacity", 0);
        });

    }

  }

  var NavigationView = {

    init: function(){
      document.body.classList.add("show-eligible");

      $('#toggler').on('click', function(e){
        var $target = $(e.target);
        $target.toggleClass('active');

        Controller.render('cume');

        switch($target.data('view')){
          case 'eligible':
            document.body.classList.toggle("show-eligible");
            document.body.classList.toggle("hide-eligible");
            break;
          case 'newscasts':
            document.body.classList.toggle("show-newscasts");
            break;
          case 'local':
            document.body.classList.toggle("show-local");
            break;
          case 'newscasts-and-local':
            document.body.classList.toggle("show-both");
            break;
          case 'neither':
            document.body.classList.toggle("show-neither");
            break;
          default:
            break;
        }

      });

      // $('input:radio').on('click', function(e){

      //   if(e.target.checked){
      //     Controller.render('cume');
      //   }

      //   document.body.className = '';

      //   var selection = $('input[name=data-type]:checked', '#toggler').val();
      //   console.log(selection);
      //   switch(selection){
      //     case 'show-all':
      //       document.body.classList.add("show-all");
      //       htc.innerHTML = originalText;
      //       break;
      //     case 'compare':
      //       document.body.classList.add("compare-all");
      //       htc.innerHTML = "Participating stations — defined as those that have uploaded newscasts to NPR One — are green; non-participating stations do not have newscasts and are gray. Larger circles indicate stations with a higher CUME.";
      //       break;
      //     case 'newscasts':
      //       document.body.classList.add("just-newscasts");
      //       htc.innerHTML = "This map displays only those stations that are not contributing newscasts to NPR One. Look for larger circles (stations with a higher CUME) for potential opportunities.";
      //       break;
      //     case 'no-newscasts':
      //       document.body.classList.add("no-newscasts");
      //       htc.innerHTML = "This map displays only those stations that are not contributing newscasts to NPR One. Look for larger circles (stations with a higher CUME) for potential opportunities.";
      //       break;
      //     case 'newscasts-or-local':
      //       document.body.classList.add("show-participants");
      //       htc.innerHTML = "This map displays only those stations that are not contributing newscasts to NPR One. Look for larger circles (stations with a higher CUME) for potential opportunities.";
      //       break;
      //     case 'no-participation':
      //       document.body.classList.add("show-non-participants");
      //       htc.innerHTML = "This map displays only those stations that are not contributing newscasts to NPR One. Look for larger circles (stations with a higher CUME) for potential opportunities.";
      //     break;
      //     default:
      //       htc.innerHTML = originalText;
      //       document.body.classList.add("show-all");
      //   }
      // });

    }

  }

  Controller.init();

  // Replace source
  $('img').error(function(){
    $(this).hide();
  });

  function zoom() {
      g.attr("transform", "translate("
              + d3.event.translate
              + ")scale(" + d3.event.scale + ")");
  }

})();
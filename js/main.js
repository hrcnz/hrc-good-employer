
$(function() {

  // globals   
  //
  // the pseudo database: all data kept in google spreadsheet   
  var doc_key = '0AswFq_8FWOlndERBTzlFT1lCY04zWG9UcEQ1VE92eFE',
      doc_url = 'https://docs.google.com/spreadsheet/pub?hl=en_US&hl=en_US&key='+doc_key+'&output=html',
      models = {},
      views = {},
      routers = {},
      app = {},
      config = {},
      plot;  
  
  /*
   * backbone models & collections
   */
  
  // YEARS
  //
  // Model:
  // Year-specific data for all entities, based on sheet 'Year' of the google spreadsheet 
  // each year row references a year-specific sheet that holds all year- and entity specifc information
  models.Year = Backbone.Model.extend({
    // check if the year is active 
    isActive: function(){
      return (this.get('active')) === 'TRUE' ? true : false;              
    }    
  });
  // Collection of year models
  models.Years = Backbone.Collection.extend({        
    model: models.Year,
    initialize: function() {
      this.sort_key = 'year';
    },            
    //filter models by year
    byYear : function(year){
      var filtered = this.filter(function(year_model) {
        return year_model.get("year") === year;
      });
      return new models.Years(filtered);            
    },
    // allow sorting by score and alphabetically       
    comparator: function(a, b) {      
        a = a.get(this.sort_key);
        b = b.get(this.sort_key);
        return a < b ?  1
             : a > b ? -1
             :          0;      
    },  
    getRecent : function(){
      this.sort();
      return this.first().get("year");
    }
  });
  
  // TYPES CATEGORISATION
  //   
  // Defines type categories, based on sheet 'Types' of the google spreadsheet 
  models.Type = Backbone.Model.extend({});  
  models.Types = Backbone.Collection.extend({        
    model: models.Type
  });
  
  // SIZES CATEGORISATION
  // 
  // Defines staff size categories, based on sheet 'Sizes' of the google spreadsheet 
  models.Size = Backbone.Model.extend({});
  models.Sizes = Backbone.Collection.extend({        
    model: models.Size
  });
  
  // CRITERIA
  // 
  // Defines entity criteria, based on sheet 'Criteria' of the google spreadsheet 
  // Criterion ID field references column name of 'records'
  models.Criterion = Backbone.Model.extend({
    initialize: function(){
      this.id = this.get('id').replace('_','');
    },
  });
  models.Criteria = Backbone.Collection.extend({        
    model: models.Criterion,
    // the total points achievable
    // currently 1 point for each criterion
    getTotal : function(){
      return this.length;
    }
  });
  
  // CRITERIAGROUPS
  // 
  // Defines groups of entity criteria, based on sheet 'CriteriaGroups' of the google spreadsheet 
  // ID referenced by field criteriongroupid of criteria 
  models.CriteriaGroup = Backbone.Model.extend({
    //initialise
    initialize: function(){
      this.count_criteria();
    },
    //count criteria that belong to group
    count_criteria: function() {
      var group_count = 0;
      var model = this;
      app.Criteria.each(function(criterion){
        if (criterion.get('criteriongroupid') === model.get('id')){          
          group_count++;
        }        
      });
      this.count = group_count;
    },
  });
  models.CriteriaGroups = Backbone.Collection.extend({        
    model: models.CriteriaGroup
  }); 
  
  // RECORDS
  //
  // The scores for each year and entity, based on the year specific sheets of the google spreadsheet (one for each year)
  // Field entity ID connects entities' scores over multiple years
  models.Record = Backbone.Model.extend({
    initialize: function(){
      
    },
    // check if the record is active, always returns active
    isActive: function(isActive){
      isActive = typeof isActive !== "undefined" ? isActive : true;
      return (this.get('active')) === 'TRUE' ? true : !isActive;              
    },        
    // calculate total score, return as points or percentage
    getTotal : function(isPercentage){
      isPercentage = typeof isPercentage !== "undefined" ? isPercentage : false;
      var total = 0;
      var model = this;
      //count points for each criterion
      app.Criteria.each(function(criterion){
        total += model.getCriterionScore(criterion.id);
      });
      if (isPercentage){
        return Math.round((total/app.Criteria.getTotal()) * 100);      
      } else {
        return total;
      }
    },
    // get score of specific criterion, usually 0 or 1
    getCriterionScore : function(criterion_id){      
      return ($.isNumeric(this.get(criterion_id))) ? this.get(criterion_id) : 0;
    },
    // calculate score for a criteria group, return as points or percentage
    getGroupScore : function(groupid, isPercentage){
      isPercentage = typeof isPercentage !== "undefined" ? isPercentage : false;
      
      var total = 0;
      var count = 0;
      var model = this;
      //count points and number of criteria for group
      app.Criteria.each(function(criterion){
        if (criterion.get('criteriongroupid') === groupid){
          total += model.getCriterionScore(criterion.id);
          count++; // maybe better reference group count
        }
      });      
      if (isPercentage){
        return Math.round((total/count) * 100);      
      } else {
        return total;
      }
    },
    // get rank of an entity 
    getRank : function(){
      // rank is the number of entities with a greater score plus 1
      // eg no one better >>> rank 1
      // eg 10 entities with better score >>> rank 11
      return app.Records.byScore(this.get('year'),this.getTotal()).length + 1;
    },   
    getDiffTotal : function(year, isPercentage){
      isPercentage = typeof isPercentage !== "undefined" ? isPercentage : false;
      // defaults to previous year
      year = typeof year !== "undefined" ? year : this.get('year')-1;
      //get record for specified year and same entity id
      // get total of year to compare
      var preRecord = app.Records.byEntity(this.get('entityid')).byYear(year).models[0];
      if (typeof preRecord !== "undefined"){
         return this.getTotal(isPercentage) - preRecord.getTotal(isPercentage);
      } else {
        return false;
      }
    },
    getDiffRank : function(year){
      // defaults to previous year
      year = typeof year !== "undefined" ? year : this.get('year')-1;
      //get record for specified year and same entity id
      // get total of year to compare
      var preRecord = app.Records.byEntity(this.get('entityid')).byYear(year).models[0];
      if (typeof preRecord !== "undefined"){
         return this.getRank() - preRecord.getRank();
      } else {
        return false;
      }
    },    
    
  });
  // the record collection - holds all records for all entities and years
  models.Records = Backbone.Collection.extend({        
    model: models.Record,
    //
    initialize: function() {
      this.sort_key = 'title';
    },
    // allow sorting by score and alphabetically       
    comparator: function(a, b) {
      if (this.sort_key === 'score'){
        a = a.getTotal();
        b = b.getTotal();
        return a > b ?  1
             : a < b ? -1
             :          0;
      } else {
        a = a.get(this.sort_key).toLowerCase();
        b = b.get(this.sort_key).toLowerCase();
        return a > b ?  1
             : a < b ? -1
             :          0;
      }
    },
    // get sorted collection 
    sortBy: function(key){
      this.sort_key = key;
      return this.sort();
    },
    // only active
    active : function(){
      var filtered = this.filter(function(record) {
        return record.isActive();
      });
      return new models.Records(filtered);
    },
    // filter by year        
    byYear : function(year, isActive){
      isActive = typeof isActive !== "undefined" ? isActive : true;
      
      var filtered = this.filter(function(record) {
        return record.isActive(isActive) && record.get("year") === year;
      });
      return new models.Records(filtered);            
    },
    // filter by entity
    byEntity : function(entity_id, isActive){
      isActive = typeof isActive !== "undefined" ? isActive : true;      
      
      var filtered = this.filter(function(record) {
        return record.isActive(isActive) && record.get("entityid") === entity_id;
      });
      return new models.Records(filtered);         
    },
    //filter by type category
    byType : function(type, isActive){
      isActive = typeof isActive !== "undefined" ? isActive : true;
            
      var filtered = this.filter(function(record) { 
        if (type !== '') {
          return record.isActive(isActive) 
              && record.get('typeid') === type;
        } else {
          return record.isActive(isActive) 
              && record.get('typeid') === '';
        }
      });
      return new models.Records(filtered);
    },
    //filter by similar size category
    bySize : function(staffno, isActive){
      isActive = typeof isActive !== "undefined" ? isActive : true;
      
      var filtered = this.filter(function(record) { 
        if (staffno !== '' && staffno > 0) {
          var sizemin = 0;
          var sizemax = 0;
          app.Sizes.each(function(size){
            if (staffno > size.get('min') && staffno <= size.get('max') ){
              sizemin = size.get('min');
              sizemax = size.get('max');            
            }
          });
          return record.isActive(isActive) 
              && record.get('staffno') > sizemin 
              && record.get('staffno') <= sizemax;            
        } else {
          return record.isActive(isActive) 
              && (record.get('staffno') === '' || record.get('staffno') === 0) ;
        }
      }); 
      return new models.Records(filtered);
    },
    // filter by score, minimum score or range (min/max)
    byScore : function (year,min,max,isActive){
      max = typeof max !== "undefined" ? max : 0;
      isActive = typeof isActive !== "undefined" ? isActive : true;      
      
      var filtered = this.filter(function(record) { 
        if (max !== 0){
          return record.isActive(isActive) && record.getTotal() > min && record.getTotal() <= max && record.get("year") === year;
        } else {
          return record.isActive(isActive) && record.getTotal() > min && record.get("year") === year;
        }
      });
      return new models.Records(filtered);            
    },
    // calculate averages overall or by criterion and criteriongroup in percentage
    // returns averages for each year       
    getAverages : function(options){
      var defaults = {criterion:'all',group:'all'};
      
      var filters = $.extend( {}, defaults, options );
      
      // the return object array, will hold averages for each year
      var results = {};
      
      // determine number of criteria
      var no_criteria;
      if (filters.criterion !== 'all' ){
        no_criteria = 1;   
      } else if (filters.group !== 'all' ){
        no_criteria = app.CriteriaGroups.where({'id':filters.group})[0].count;       
      } else { // all
        no_criteria = app.Criteria.length;
      }
      // for all record, update totals and count, also calculates percentage each step << this could be done more efficiently
      this.each(function(record){
        //only active records
        if (record.isActive()){
          var year = record.get('year');
          //if key (year) present add totals
          if (year in results) {      
            if (filters.criterion !== 'all' ){
              results[year].total += record.getCriterionScore(filters.criterion);
            } else if (filters.group !== 'all' ){
              results[year].total += record.getGroupScore(filters.group);
            } else {
              results[year].total += record.getTotal();
            }
            results[year].count++;
          // else need to add key first
          } else {
            results[year] = {};
            if (filters.criterion !== 'all' ){
              results[year].total = record.getCriterionScore(filters.criterion);
            } else if (filters.group !== 'all' ){
              results[year].total = record.getGroupScore(filters.group);
            } else {
              results[year].total = record.getTotal();
            }              
            results[year].count = 1;
          }            
          results[year].percentage = Math.round(((results[year].total/results[year].count)/no_criteria) * 100);          
        }
      });
      return results;      
    },
    
    
  });
  
 /*
  * views.Tools
 */ 
  views.Tools = Backbone.View.extend({
    initialize: function (attrs) {
        this.options = attrs;
    },    
  });
 /* 
  * views.Overview
  */
  views.Overview = Backbone.View.extend({
    initialize: function (attrs) {
        this.options = attrs;
    },
//    attributes: { class: '' },
//
//    plotOptions: {
//      yaxis: {},
//      xaxis: {},
//      legend: { show: true },
//      grid: { 
//        hoverable: true, 
//        clickable: true, 
//        autoHighlight: true, 
//        backgroundColor: '#ffffff'
//      },
//      series: {
//           bars: { show: true, fill: 0.7, barWidth: 0.8, align: 'center' }
//      }
//    },
//
//    render: function() {
//
//      this.$el.html('<div class="legend"></div><div class="plot"></div>');
//
//      return this;
//    },
//
//    renderGraph: function() {
//
//      var options = _.clone(this.plotOptions);
//      var data= [];
//      for ( i=0;i<this.collection.length;i++ ) {
//          data.push([i, this.collection.models[i].getTotal() ]);
//      }        
//
//      var dataset = [{ label : 'Entity Totals', data : data }];
//
//      // Now, the chart can be drawn ...
//      plot = $.plot( this.$('.plot'), dataset, options );
//
//    }      

  });  
    
  /*  
  views.Details
  for each criteria 
    if criterion does not belong to any group:
      criteriaView.render
    else
      if !group rendered:
        CriteriaGroupView.render
  */
  views.Details = Backbone.View.extend({
    initialize: function (attrs) {
        this.options = attrs;
    },    
  }); 
  
  // Routers
  routers.App = Backbone.Router.extend({
    routes: {
        '': 'redirect',
        'report/*filter': 'redirect',
        ':year': 'year',
        ':year/report/*filter': 'report' //fully qualified
    },            
    // year missing > add most recent year
    redirect: function(route) {
        console.log('route:redirect');
        
        var year = app.Years.getRecent(); 
        
        if (route) {          
          this.navigate(year.toString() + '/report/' + route, {trigger: true});
        } else {
          this.navigate(year.toString(), {trigger: true});
        }
    },
    // year specified, report missing >>> add report
    year: function(year) {
        console.log('route:year');
        
        //may need to validate further
        if ($.isNumeric(year)) {
          this.navigate(year + '/report/entities-all', {trigger: true});
        } else {
          // back to start
          this.navigate('', {trigger: true});
        }
    },
    // fully qualified >>> display report
    report: function(year, route) {        
        console.log('route:report');
        
        // Parse hash
        var filter = route.split('-');
        config.year = year;        
        config.report = { collection: filter[0], id: filter[1] };
                
        // Load the tools view
        this.tools    = new views.Tools(config.report);        
        // Load the overview view
        this.overview = new views.Overview(config.report);
        // Load the details view
        this.details  = new views.Details(config.report);
    
    },

  });


//    app.Overview = new views.Overview({ collection:app.Records.byYear(2013).sortBy('score')});
    
    
//    
//    // add the stub HTML required by Flot to hold the graph canvas
//    $("#overview").append( app.Overview.render().el );
//    
//    // show the flot graph
//    app.Overview.renderGraph();
  
  
  /*
   * data_init
   * 
   * set up models and collections
   * 
   * @param {type} data: all spreadsheet data 
   * @returns {undefined}
   */  
  function data_init (data){
    // 1. init years/config
    app.Years = new models.Years(data.Years.elements);    
    // 2. init types
    app.Types = new models.Types(data.Types.elements);    
    // 3. init sizes
    app.Sizes = new models.Sizes(data.Sizes.elements);    
    // 4. init criteria and criteriaGroups
    app.Criteria = new models.Criteria(data.Criteria.elements);  
    app.CriteriaGroups = new models.CriteriaGroups(data.CriteriaGroups.elements);      
    // 5. finally init records
    // for all active years 
    // try to find data, data["year"].elements
    app.Records = new models.Records();
    app.Years.each(function(year){
      if (year.isActive()) {
        var records = data[year.get('year')].elements;
        _.each(records, function(record){
          record.year = year.get('year');
        });
        app.Records.add(records);   
      }
    });    
    console.log('data initialised');
  }
  
  /*
   * storageReady
   * 
   * called when all spreadsheet data is stored 
   *    
   * @param {type} data
   * @param {type} tabletop
   * @returns {undefined}
   */
  function data_loaded(data, tabletop){
    console.log('data loaded');
    // initialise data
    data_init(data);  
    // start application
    app.App = new routers.App();
    Backbone.history.start();
  }
  
    // Start the application
  $(function() {
    //Initialise tabletop instance with data, calls data_loaded when all data read
    var tabletop = Tabletop.init({ key: doc_url, parseNumbers : true, callback: data_loaded });
  });  

//  
//  
//  function renderPdf() {   
//      var srcCanvas = plot.getCanvas();
//      var destinationCanvas = document.createElement("canvas");
//      destinationCanvas.width = srcCanvas.width;
//      destinationCanvas.height = srcCanvas.height;
//
//      var destCtx = destinationCanvas.getContext('2d');
//
//      //create a rectangle with the desired color
//      destCtx.fillStyle = "#FFFFFF";
//      destCtx.fillRect(0,0,srcCanvas.width,srcCanvas.height);
//
//      //draw the original canvas onto the destination canvas
//      destCtx.drawImage(srcCanvas, 0, 0);
//      var imgData = destinationCanvas.toDataURL('image/jpeg');
//
//      var doc = new jsPDF('p', 'pt', 'a4');
//
//      doc.addImage(imgData, 'JPEG', 15, 40, 400, 200);
//      doc.output('datauri');
//
//  } 
  
  

  
});


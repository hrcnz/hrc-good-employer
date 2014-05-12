
//$(function() {
  var doc_key = '0AswFq_8FWOlndERBTzlFT1lCY04zWG9UcEQ1VE92eFE',
      doc_url = 'https://docs.google.com/spreadsheet/pub?hl=en_US&hl=en_US&key='+doc_key+'&output=html',
      models = {},
      views = {},
      routers = {},
      app = {},
      plot;  
  
  // backbone models & collections
  models.Year = Backbone.Model.extend({
    isActive: function(){
      return (this.get('active')) === 'TRUE' ? true : false;              
    }    
  });
  models.Years = Backbone.Collection.extend({        
    model: models.Year,
    byYear : function(year){
      var filtered = this.filter(function(year_model) {
        return year_model.get("year") === year;
      });
      return new models.Years(filtered);            
    },
  });
  
  models.Type = Backbone.Model.extend({    
  });  
  models.Types = Backbone.Collection.extend({        
        model: models.Type
  });
  
  models.Size = Backbone.Model.extend({    
  });
  models.Sizes = Backbone.Collection.extend({        
    model: models.Size
  });
  
  models.Criterion = Backbone.Model.extend({    
  });
  models.Criteria = Backbone.Collection.extend({        
    model: models.Criterion,    
  });
  
  models.CriteriaGroup = Backbone.Model.extend({    
    initialize: function(){
      this.count_criteria();
    },
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
  
  models.Record = Backbone.Model.extend({
    isActive: function(){
      return (this.get('active')) === 'TRUE' ? true : false;              
    },
    getTotal : function(isPercentage){
      isPercentage = typeof isPercentage !== "undefined" ? isPercentage : false;
      var total = 0;
      var model = this;
      app.Criteria.each(function(criterion){
        total += model.get(criterion.get('id').replace('_',''));
      });
      if (isPercentage){
        return Math.round((total/app.Criteria.length) * 100);      
      } else {
        return total;
      }
    },           
    getScore : function(criterion){      
      return this.get(criterion);
    },
    getGroupScore : function(groupid, isPercentage){
      isPercentage = typeof isPercentage !== "undefined" ? isPercentage : false;
      
      var total = 0;
      var count = 0;
      var model = this;
      app.Criteria.each(function(criterion){
        if (criterion.get('criteriongroupid') === groupid){
          total += model.get(criterion.get('id').replace('_',''));
          count++;
        }
      });      
      if (isPercentage){
        return Math.round((total/count) * 100);      
      } else {
        return total;
      }
    },
    getRank : function(){
      // rank is the number of entities with a greater score plus 1
      // eg no one better >>> rank 1
      // eg 10 entities with better score >>> rank 11
      return app.Records.byScore(this.get('year'),this.getTotal()).length + 1;
    },   
    getDiffTotal : function(year){
      //get record for specified year and same entity id
      //TODO
    },
    getDiffRank : function(year){
      //TODO      
    }
    
  });
  models.Records = Backbone.Collection.extend({        
    model: models.Record,
    initialize: function() {
      this.sort_key = 'title';
    },
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
    sort_by_score : function(){
      this.sort_key = 'score';
      return this.sort();
    },
    byYear : function(year){
      var filtered = this.filter(function(record) {
        return record.isActive() && record.get("year") === year;
      });
      return new models.Records(filtered);            
    },
    byEntity : function(entity_id){
      var filtered = this.filter(function(record) {
        return record.get("entityid") === entity_id;
      });
      return new models.Records(filtered);         
    },
    byType : function(type){
      var filtered = this.filter(function(record) { 
        return record.isActive() && record.get('typeid') === type;
      });
      return new models.Records(filtered);
    },
    bySize : function(staffno){      
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
          return record.isActive() && record.get('staffno') > sizemin && record.get('staffno') <= sizemax;            
        } else {
          return record.isActive() && record.get('staffno') === '' || record.get('staffno') === 0 ;
        }
      }); 
      return new models.Records(filtered);
    },
    byScore : function (year,min,max){
      max = typeof max !== "undefined" ? max : 0;
      
      var filtered = this.filter(function(record) { 
        if (max !== 0){
          return record.isActive() && record.getTotal() > min && record.getTotal() <= max && record.get("year") === year;
        } else {
          return record.isActive() && record.getTotal() > min && record.get("year") === year;
        }
      });
      return new models.Records(filtered);            
    },           
    getAverages : function(options){
      var defaults = {type : 'all',size: 'all',criterion:'all',criteriaGroup:'all'};
      
      var filters = $.extend( {}, defaults, options );
      
      var filtered = this;
      if (filters.type !== 'all'){
        filtered = filtered.byType(filters.type);
      }
      if (filters.size !== 'all'){
        filtered = filtered.bySize(filters.size);
      }      
      
      var results = {};
      var no_criteria;
      if (filters.criterion !== 'all' ){
        no_criteria = 1;   
      } else if (filters.criteriaGroup !== 'all' ){
        no_criteria = app.CriteriaGroups.where({'id':filters.criteriaGroup})[0].count;       
      } else { // all
        no_criteria = app.Criteria.length;
      }
      filtered.each(function(record){
        if (record.isActive()){
          var year = record.get('year');          
          if (year in results) {      
            if (filters.criterion !== 'all' ){
              results[year].total += record.getScore(filters.criterion);
            } else if (filters.criteriaGroup !== 'all' ){
              results[year].total += record.getGroupScore(filters.criteriaGroup);
            } else {
              results[year].total += record.getTotal();
            }
            results[year].count++;
          } else {
            results[year] = {};
            if (filters.criterion !== 'all' ){
              results[year].total = record.getScore(filters.criterion);
            } else if (filters.criteriaGroup !== 'all' ){
              results[year].total = record.getGroupScore(filters.criteriaGroup);
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

 /* 
  * views.Overview
  */
  views.Overview = Backbone.View.extend({

    attributes: { class: '' },

    plotOptions: {
      yaxis: {},
      xaxis: {},
      legend: { show: true },
      grid: { 
        hoverable: true, 
        clickable: true, 
        autoHighlight: true, 
        backgroundColor: '#ffffff'
      },
      series: {
           bars: { show: true, fill: 0.7, barWidth: 0.8, align: 'center' }
      }
    },

    render: function() {

      this.$el.html('<div class="legend"></div><div class="plot"></div>');

      return this;
    },

    renderGraph: function() {

      var options = _.clone(this.plotOptions);
      var data= [];
      for ( i=0;i<this.collection.length;i++ ) {
          data.push([i, this.collection.models[i].getTotal() ]);
      }        

      var dataset = [{ label : 'Entity Totals', data : data }];

      // Now, the chart can be drawn ...
      plot = $.plot( this.$('.plot'), dataset, options );

    }      

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

 
  function storageReady(data, tabletop){
    console.log('storageReady');
    initData(data);        

//    app.Overview = new views.Overview({ collection:app.Records.byYear(2013).sort_by_score()});
    
    
//    
//    // add the stub HTML required by Flot to hold the graph canvas
//    $("#overview").append( app.Overview.render().el );
//    
//    // show the flot graph
//    app.Overview.renderGraph();
  }
  
  function initData (data){
    // 1. init years/config
    app.Years = new models.Years(data.Years.elements);    
    // 2. init types
    app.Types = new models.Types(data.Types.elements);    
    // 3. init sizes
    app.Sizes = new models.Sizes(data.Sizes.elements);    
    // 4. init types
    app.Criteria = new models.Criteria(data.Criteria.elements);  
    app.CriteriaGroups = new models.CriteriaGroups(data.CriteriaGroups.elements);  
    
    // 5. finally init records
    // for all years 
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
    console.log('dataReady');
  }
  
  $(document).ready( function() {  
    //Init tabletop instance
    var tabletop = Tabletop.init({ key: doc_url, parseNumbers : true, callback: storageReady });
//    $('#export').click(function() {
//      renderPdf();
//    });
  });
  
  
  function renderPdf() {   
      var srcCanvas = plot.getCanvas();
      var destinationCanvas = document.createElement("canvas");
      destinationCanvas.width = srcCanvas.width;
      destinationCanvas.height = srcCanvas.height;

      var destCtx = destinationCanvas.getContext('2d');

      //create a rectangle with the desired color
      destCtx.fillStyle = "#FFFFFF";
      destCtx.fillRect(0,0,srcCanvas.width,srcCanvas.height);

      //draw the original canvas onto the destination canvas
      destCtx.drawImage(srcCanvas, 0, 0);
      var imgData = destinationCanvas.toDataURL('image/jpeg');

      var doc = new jsPDF('p', 'pt', 'a4');

      doc.addImage(imgData, 'JPEG', 15, 40, 400, 200);
      doc.output('datauri');

  } 
//});


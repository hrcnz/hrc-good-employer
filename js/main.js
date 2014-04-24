
$(function() {
  var doc_key = '0AswFq_8FWOlndERBTzlFT1lCY04zWG9UcEQ1VE92eFE',
      doc_url = 'https://docs.google.com/spreadsheet/pub?hl=en_US&hl=en_US&key='+doc_key+'&output=html',
      models = {},
      views = {},
      routers = {},
      app = {},
      plot;  
  
  // backbone models
  models.Year = Backbone.Model.extend({
    isActive: function(){
      return (this.get('active')) === 'TRUE' ? true : false;              
    }
  });
  models.Years = Backbone.Collection.extend({        
        model: models.Year
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
    model: models.Criterion
  });
  
  models.CriteriaGroup = Backbone.Model.extend({    
  });
  models.CriteriaGroups = Backbone.Collection.extend({        
    model: models.CriteriaGroup
  });
  
  models.Entity = Backbone.Model.extend({
  });
  models.Entities = Backbone.Collection.extend({        
    model: models.Entity,
    initialize: function() {
      this.sort_key = 'title';
    },
    comparator: function(a, b) {
      a = a.get(this.sort_key).toLowerCase();
      b = b.get(this.sort_key).toLowerCase();
      return a > b ?  1
           : a < b ? -1
           :          0;
    }        
  });   
  
  models.Record = Backbone.Model.extend({
    getTotal : function(){
      var total = 0;
      var model = this;//there must be a better way
      app.Criteria.each(function(criterion){
        total += model.get(criterion.get('criterioncolumn').replace('_',''));
      });
      return total;
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
        return record.get("year") === year;
      });
      return new models.Records(filtered);            
    },
    byEntity : function(entity_id){
      var filtered = this.filter(function(record) {
        return record.get("entityid") === entity_id;
      });
      return new models.Records(filtered);         
    },
  });
  
 /*
  views.Tools
  
  views.Overview
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

    app.Overview = new views.Overview({ collection:app.Records.byYear(2013).sort_by_score()});
    
    // add the stub HTML required by Flot to hold the graph canvas
    $("#overview").append( app.Overview.render().el );
    
    // show the flot graph
    app.Overview.renderGraph();
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
        app.Records.add(records);//console.log(year.get('year'));      
      }
    });    
    console.log('dataReady');
  }
  
  $(document).ready( function() {  
    //Init tabletop instance
    var tabletop = Tabletop.init({ key: doc_url, parseNumbers : true, callback: storageReady });
    $('#export').click(function() {
      renderPdf();
    });
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
});


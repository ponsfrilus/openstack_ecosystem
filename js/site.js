/*!
* site.js
*
* the arbor.js website
*/
(function($){
  // var trace = function(msg){
  //   if (typeof(window)=='undefined' || !window.console) return
  //   var len = arguments.length, args = [];
  //   for (var i=0; i<len; i++) args.push("arguments["+i+"]")
  //   eval("console.log("+args.join(",")+")")
  // }

  var Renderer = function(elt){
    var dom = $(elt)
    var canvas = dom.get(0)
    var ctx = canvas.getContext("2d");
    var gfx = arbor.Graphics(canvas)
    var sys = null

    var _vignette = null
    var selected = null,
        nearest = null,
        _mouseP = null;


    var that = {
      init:function(pSystem){
        sys = pSystem
        sys.screen({size:{width:dom.width(), height:dom.height()},
                    padding:[36,60,36,60]})

        $(window).resize(that.resize)
        that.resize()
        that._initMouseHandling()

        /*if (document.referrer.match(/echolalia|atlas|halfviz/)){
          // if we got here by hitting the back button in one of the demos,
          // start with the demos section pre-selected
          that.switchSection('Computing')
        }*/
      },
      resize:function(){
        canvas.width = $(window).width()
        canvas.height = .85* $(window).height()
        sys.screen({size:{width:canvas.width, height:canvas.height}})
        _vignette = null
        that.redraw()
      },
      redraw:function(){
        gfx.clear()
        sys.eachEdge(function(edge, p1, p2){
          if (edge.source.data.alpha * edge.target.data.alpha == 0) return
          gfx.line(p1, p2, {stroke:"#b2b19d", width:2, alpha:edge.target.data.alpha})
        })
        sys.eachNode(function(node, pt){
          var w = Math.max(20, 20+gfx.textWidth(node.name) )
          if (node.data.alpha===0) return
          if (node.data.shape=='dot'){
            gfx.oval(pt.x-w/2, pt.y-w/2, w, w, {fill:node.data.color, alpha:node.data.alpha})
            gfx.text(node.name, pt.x, pt.y+7, {color:"white", align:"center", font:"Arial", size:12})
            gfx.text(node.name, pt.x, pt.y+7, {color:"white", align:"center", font:"Arial", size:12})
          }else{
            gfx.rect(pt.x-w/2, pt.y-8, w, 20, 4, {fill:node.data.color, alpha:node.data.alpha})
            gfx.text(node.name, pt.x, pt.y+9, {color:"white", align:"center", font:"Arial", size:12})
            gfx.text(node.name, pt.x, pt.y+9, {color:"white", align:"center", font:"Arial", size:12})
          }
        })
        that._drawVignette()
      },

      _drawVignette:function(){
        var w = canvas.width
        var h = canvas.height
        var r = 20

        if (!_vignette){
          var top = ctx.createLinearGradient(0,0,0,r)
          top.addColorStop(0, "#e0e0e0")
          top.addColorStop(.7, "rgba(255,255,255,0)")

          var bot = ctx.createLinearGradient(0,h-r,0,h)
          bot.addColorStop(0, "rgba(255,255,255,0)")
          bot.addColorStop(1, "white")

          _vignette = {top:top, bot:bot}
        }

        // top
        ctx.fillStyle = _vignette.top
        ctx.fillRect(0,0, w,r)

        // bot
        ctx.fillStyle = _vignette.bot
        ctx.fillRect(0,h-r, w,r)
      },

      switchMode:function(e){
        if (e.mode=='hidden'){
          dom.stop(true).fadeTo(e.dt,0, function(){
            if (sys) sys.stop()
            $(this).hide()
          })
        }else if (e.mode=='visible'){
          dom.stop(true).css('opacity',0).show().fadeTo(e.dt,1,function(){
            that.resize()
          })
          if (sys) sys.start()
        }
      },

      switchSection:function(newSection){
        var parent = sys.getEdgesFrom(newSection)[0].source
        var children = $.map(sys.getEdgesFrom(newSection), function(edge){
          return edge.target
        })

        sys.eachNode(function(node){
          if (node.data.shape=='dot') return // skip all but leafnodes

          var nowVisible = ($.inArray(node, children)>=0)
          var newAlpha = (nowVisible) ? 1 : 0
          var dt = (nowVisible) ? .5 : .5
          sys.tweenNode(node, dt, {alpha:newAlpha})

          if (newAlpha==1){
            node.p.x = parent.p.x + .05*Math.random() - .025
            node.p.y = parent.p.y + .05*Math.random() - .025
            node.tempMass = .001
          }
        })
      },


      _initMouseHandling:function(){
        // no-nonsense drag and drop (thanks springy.js)
        selected = null;
        nearest = null;
        var dragged = null;
        var oldmass = 1

        var _section = null

        var handler = {
          moved:function(e){
            var pos = $(canvas).offset();
            _mouseP = arbor.Point(e.pageX-pos.left, e.pageY-pos.top)
            nearest = sys.nearest(_mouseP);

            if (!nearest.node) return false

            if (nearest.node.data.shape!='dot'){
              selected = (nearest.distance < 50) ? nearest : null
              if (selected){
                 dom.addClass('linkable')
                 window.status = selected.node.data.link.replace(/^\//,"http://"+window.location.host+"/").replace(/^#/,'')
              }
              else{
                 dom.removeClass('linkable')
                 window.status = ''
              }
            }else {
              //if ($.inArray(nearest.node.name, ['openstack','Computing','Networking','Storing','Identity','Telemetry','Orchestration','Database','Dashboard','Common Libraries','Bare Metal','Hypervisor','Deployment','Operating System']) >=0 ){
              if (nearest.node.name!=_section){
                _section = nearest.node.name
                that.switchSection(_section)
              }
              dom.removeClass('linkable')
              window.status = ''
            }

            return false
          },
          clicked:function(e){
            var pos = $(canvas).offset();
            _mouseP = arbor.Point(e.pageX-pos.left, e.pageY-pos.top)
            nearest = dragged = sys.nearest(_mouseP);

            if (nearest && selected && nearest.node===selected.node){
              var link = selected.node.data.link
              if (link.match(/^#/)){
                 $(that).trigger({type:"navigate", path:link.substr(1)})
              }else{
                 window.location = link
              }
              return false
            }


            if (dragged && dragged.node !== null) dragged.node.fixed = true

            $(canvas).unbind('mousemove', handler.moved);
            $(canvas).bind('mousemove', handler.dragged)
            $(window).bind('mouseup', handler.dropped)

            return false
          },
          dragged:function(e){
            var old_nearest = nearest && nearest.node._id
            var pos = $(canvas).offset();
            var s = arbor.Point(e.pageX-pos.left, e.pageY-pos.top)

            if (!nearest) return
            if (dragged !== null && dragged.node !== null){
              var p = sys.fromScreen(s)
              dragged.node.p = p
            }

            return false
          },

          dropped:function(e){
            if (dragged===null || dragged.node===undefined) return
            if (dragged.node !== null) dragged.node.fixed = false
            dragged.node.tempMass = 1000
            dragged = null;
            // selected = null
            $(canvas).unbind('mousemove', handler.dragged)
            $(window).unbind('mouseup', handler.dropped)
            $(canvas).bind('mousemove', handler.moved);
            _mouseP = null
            return false
          }


        }

        $(canvas).mousedown(handler.clicked);
        $(canvas).mousemove(handler.moved);

      }
    }

    return that
  }


  var Nav = function(elt){
    var dom = $(elt)

    var _path = null

    var that = {
      init:function(){
        $(window).bind('popstate',that.navigate)
        dom.find('> a').click(that.back)
        $('.more').one('click',that.more)

        $('#Computing dl:not(.datastructure) dt').click(that.reveal)
        that.update()
        return that
      },
      more:function(e){
        $(this).removeAttr('href').addClass('less').html('&nbsp;').siblings().fadeIn()
        $(this).next('h2').find('a').one('click', that.less)

        return false
      },
      less:function(e){
        var more = $(this).closest('h2').prev('a')
        $(this).closest('h2').prev('a')
        .nextAll().fadeOut(function(){
          $(more).text('creation & use').removeClass('less').attr('href','#')
        })
        $(this).closest('h2').prev('a').one('click',that.more)

        return false
      },
      reveal:function(e){
        $(this).next('dd').fadeToggle('fast')
        return false
      },
      back:function(){
        _path = "/"
        if (window.history && window.history.pushState){
          window.history.pushState({path:_path}, "", _path);
        }
        that.update()
        return false
      },
      navigate:function(e){
        var oldpath = _path
        if (e.type=='navigate'){
          _path = e.path
          if (window.history && window.history.pushState){
             window.history.pushState({path:_path}, "", _path);
          }else{
            that.update()
          }
        }else if (e.type=='popstate'){
          var state = e.originalEvent.state || {}
          _path = state.path || window.location.pathname.replace(/^\//,'')
        }
        if (_path != oldpath) that.update()
      },
      update:function(){
        var dt = 'fast'
        if (_path===null){
          // this is the original page load. don't animate anything just jump
          // to the proper state
          _path = window.location.pathname.replace(/^\//,'')
          dt = 0
          dom.find('p').css('opacity',0).show().fadeTo('slow',1)
        }

        switch (_path){
          case '':
          case '/':
          dom.find('p').text('a graph visualization of openstack ecosystem')
          dom.find('> a').removeClass('active').attr('href','#')
          break

        }

      }
    }
    return that
  }

  $(document).ready(function(){
    var CLR = {
      branch:"#b2b19d",
      code:"orange",
      doc:"#922E00",
      demo:"#a7af00"
    }

    var theUI = {
      nodes:{"openstack":{color:"red", shape:"dot", alpha:1},

            Computing:{color:CLR.branch, shape:"dot", alpha:1},
              Nova:{color:CLR.code, alpha:0, link:'https://wiki.openstack.org/wiki/Nova'},
              Glance:{color:CLR.code, alpha:0, link:'https://wiki.openstack.org/wiki/Glance'},

            Networking:{color:CLR.branch, shape:"dot", alpha:1},
              Neutron:{color:CLR.code, alpha:0, link:'https://wiki.openstack.org/wiki/Neutron'},

            Storing:{color:CLR.branch, shape:"dot", alpha:1},
              Swift:{color:CLR.code, alpha:0, link:'https://wiki.openstack.org/wiki/Swift'},
              Cinder:{color:CLR.code, alpha:0, link:'https://wiki.openstack.org/wiki/Cinder'},

            Identity:{color:CLR.branch, shape:"dot", alpha:1},
              Keystone:{color:CLR.code, alpha:0, link:'https://wiki.openstack.org/wiki/Keystone'},

            Telemetry:{color:CLR.branch, shape:"dot", alpha:1},
              Ceilometer:{color:CLR.code, alpha:0, link:'https://wiki.openstack.org/wiki/Ceilometer'},

            Orchestration:{color:CLR.branch, shape:"dot", alpha:1},
              Heat:{color:CLR.code, alpha:0, link:'https://wiki.openstack.org/wiki/Heat'},

            Database:{color:CLR.branch, shape:"dot", alpha:1},
              Trove:{color:CLR.code, alpha:0, link:'https://wiki.openstack.org/wiki/Trove'},
              Galera:{color:CLR.code, alpha:0, link:'https://github.com/codership/galera'},
              Percona XtraDB Cluster:{color:CLR.code, alpha:0, link:'https://launchpad.net/percona-xtradb-cluster'},

            Dashboard:{color:CLR.branch, shape:"dot", alpha:1},
              Horizon:{color:CLR.code, alpha:0, link:'https://wiki.openstack.org/wiki/Trove'},

            "Common Libraries":{color:CLR.branch, shape:"dot", alpha:1},
              Oslo:{color:CLR.code, alpha:0, link:'https://wiki.openstack.org/wiki/Oslo'},

            "Bare Metal":{color:CLR.branch, shape:"dot", alpha:1},
              Ironic:{color:CLR.code, alpha:0, link:'https://wiki.openstack.org/wiki/Ironic'},
              Foreman:{color:CLR.code, alpha:0, link:'http://theforeman.org/'},

            "Data processing":{color:CLR.branch, shape:"dot", alpha:1},
              Sahara:{color:CLR.code, alpha:0, link:'https://wiki.openstack.org/wiki/Sahara'},

            Hypervisor:{color:CLR.branch, shape:"dot", alpha:1},
              KVM:{color:CLR.code, alpha:0, link:'http://www.linux-kvm.org/'},
              Qemu:{color:CLR.code, alpha:0, link:'http://wiki.qemu.org/'},
              ESX:{color:CLR.code, alpha:0, link:'http://www.vmware.com/products/esxi-and-esx/'},
              Docker:{color:CLR.code, alpha:0, link:'https://www.docker.com/'},
              LXC:{color:CLR.code, alpha:0, link:'https://linuxcontainers.org/'},
              Xen:{color:CLR.code, alpha:0, link:'http://www.xenproject.org/'},
              HyperV:{color:CLR.code, alpha:0, link:'http://www.microsoft.com/en-us/server-cloud/solutions/virtualization.aspx'},

            Deployment:{color:CLR.branch, shape:"dot", alpha:1},
              Puppet:{color:CLR.code, alpha:0, link:'http://puppetlabs.com/'},
              Chef:{color:CLR.code, alpha:0, link:'https://www.getchef.com/'},
              Ansible:{color:CLR.code, alpha:0, link:'http://www.ansible.com/'},
              DevStack:{color:CLR.code, alpha:0, link:'http://docs.openstack.org/developer/devstack/'},
              PackStack:{color:CLR.code, alpha:0, link:'https://wiki.openstack.org/wiki/Packstack'},
              Salt:{color:CLR.code, alpha:0, link:'http://www.saltstack.com/'},
              Juju:{color:CLR.code, alpha:0, link:'https://juju.ubuntu.com/'},
              Crowbar:{color:CLR.code, alpha:0, link:'http://crowbar.github.io/'},
              "Cloud Foundry":{color:CLR.code, alpha:0, link:'http://cloudfoundry.org'},
              "Fuel":{color:CLR.code, alpha:0, link:'https://wiki.openstack.org/wiki/Fuel'},
              TripleO:{color:CLR.code, alpha:0, link:'https://wiki.openstack.org/wiki/TripleO'},

            "Quality Assurance":{color:CLR.branch, shape:"dot", alpha:1},
              Tempest:{color:CLR.code, alpha:0, link:'http://docs.openstack.org/developer/tempest/'},
              Kong:{color:CLR.code, alpha:0, link:'https://github.com/cloudbuilders/kong'},
              Zodiac:{color:CLR.code, alpha:0, link:'https://github.com/rohit-k/zodiac'},
              Torpedo:{color:CLR.code, alpha:0, link:'https://github.com/dprince/torpedo'},
              Backfire:{color:CLR.code, alpha:0, link:'https://github.com/ohthree/backfire'},
              Lettuce:{color:CLR.code, alpha:0, link:'http://lettuce.it/'},
              "Reddwarf Integration Tests":{color:CLR.code, alpha:0, link:'https://github.com/rackspace/reddwarf'},
              StackTester:{color:CLR.code, alpha:0, link:'https://github.com/rackspace-titan/stacktester'},
              SmokeStack:{color:CLR.code, alpha:0, link:'https://github.com/dprince/smokestack'},

            "Operating System":{color:CLR.branch, shape:"dot", alpha:1},
              Ubuntu:{color:CLR.code, alpha:0, link:'http://www.ubuntu.com/'},
              CentOS:{color:CLR.code, alpha:0, link:'http://www.centos.org/'},
              "Red Hat":{color:CLR.code, alpha:0, link:'http://www.redhat.com/'},
              Windows:{color:CLR.code, alpha:0, link:'http://windows.microsoft.com/'},
              Debian:{color:CLR.code, alpha:0, link:'https://www.debian.org/'},
              "Scientific Linux":{color:CLR.code, alpha:0, link:'https://www.scientificlinux.org/'},
              Suse:{color:CLR.code, alpha:0, link:'https://www.suse.com/'},
              Fedora:{color:CLR.code, alpha:0, link:'http://fedoraproject.org/'},
            },
      edges:{
        "openstack":{
          Computing:{length:.8},
          Networking:{length:.8},
          Storing:{length:.8},
          Identity:{length:.8},
          Telemetry:{length:.8},
          Orchestration:{length:.8},
          Database:{length:.8},
          Dashboard:{length:.8},
          "Common Libraries":{length:.8},
          "Bare Metal":{length:.8},
          Hypervisor:{length:.8},
          Deployment:{length:.8},
          "Data processing":{length:.8},
          "Quality Assurance":{length:.8},
          "Operating System":{length:.8},
        },
        Computing:{
          Nova:{},
          Glance:{},
        },
        Networking:{
          Neutron:{},
        },
        Storing:{
          Swift:{},
          Cinder:{},
        },
        Identity:{
          Keystone:{},
        },
        Telemetry:{
          Ceilometer:{},
        },
        Orchestration:{
          Heat:{},
        },
        Database:{
          Trove:{},
          Galera:{},
        },
        Dashboard:{
          Horizon:{},
        },
        "Common Libraries":{
          Oslo:{},
        },
        "Bare Metal":{
          Ironic:{},
          Foreman:{},
        },
        "Data processing":{
          Sahara:{},
        },
        Hypervisor:{
          KVM:{},
          Qemu:{},
          ESX:{},
          Docker:{},
          LXC:{},
          Xen:{},
          HyperV:{},
        },
        Deployment:{
          Puppet:{},
          Chef:{},
          Ansible:{},
          DevStack:{},
          PackStack:{},
          Salt:{},
          Juju:{},
          Crowbar:{},
          TripleO:{},
          Fuel:{},
        },
        "Quality Assurance":{
          Tempest:{},
          Kong:{},
          Zodiac:{},
          Torpedo:{},
          Backfire:{},
          Lettuce:{},
          "Reddwarf Integration Tests":{},
          StackTester:{},
          SmokeStack:{},
        },
        "Operating System":{
          Ubuntu:{},
          CentOS:{},
          "Red Hat":{},
          Windows:{},
          Debian:{},
          "Scientific Linux":{},
          Suse:{},
          Fedora:{},
        },
      }
    }


    var sys = arbor.ParticleSystem()
    sys.parameters({stiffness:900, repulsion:2000, gravity:true, dt:0.015})
    sys.renderer = Renderer("#sitemap")
    sys.graft(theUI)

    var nav = Nav("#nav")
    $(sys.renderer).bind('navigate', nav.navigate)
    $(nav).bind('mode', sys.renderer.switchMode)
    nav.init()
  })
})(this.jQuery)

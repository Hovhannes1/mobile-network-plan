//Input Data
//The deployment area is subdivided into blocks, each block is subdivided into bins (geographical points)
var colorPicker;
var areaWidth = 200; //Number of columns of the deployment area by default
var areaHeight = 200; //Number of lines of the deployment area by default

var southCorner; //the south-East point of the deployment area

var latBin; //Lat size of a bin (about 10metres)
var lngBin; //Lng size a bin (about 10metres)

var relief = []; //elevation of the natural landscape
var architecture = []; //elevation of the buildings
var elevation = []; //the total elevation of natural landscape and buildings

var frequencySpectrum, qualityThreshold; // radio interface characteristics : quality threshold and frequency band
var antenne;
var CCost = 0;
var carto = false;
var a;
var angleindex;

var firstpropag = true; //the relief table should be normalized at the beginning
function AntennaConstructor(location, omni, tilt, azimut, pow) {
    this.location = location; //position of the antenna
    this.omni = omni; //omni or not
    this.azimut = azimut; //azimuth in radian
    this.power = pow; //power in Db
    this.tilt = tilt; //tilt in radian
}

var antennas = []; //set of antennas
var nbantennas = 0; //number of antennas
var bins = [];
var axes = []; //set of roads - not yet implemented
var largaxes = []; //width of the roads
var isOnTheRoad = [];
var orientation = []; //sens of circulation

var power = []; //power received of each bin (x,y) from an antenna (z) = power[z][x][y]
//directional antenna radiation pattern
var VertRadiationPattern = [
    0, -4, -8, -12, -15, -17, -18, -19, -20, -23, -26, -28, -30, -31, -31, -30,
    -27, -23, -18, -23, -27, -31, -33, -34, -33, -31, -29, -26, -23, -20, -18,
    -19, -20, -19, -19, -18, -18, -18, -19, -19, -20, -19, -18, -20, -23, -26,
    -29, -31, -33, -34, -33, -31, -27, -23, -18, -23, -27, -30, -31, -31, -30,
    -28, -26, -23, -20, -19, -18, -17, -15, -12, -8, -4, 0,
];
var HorzRadiationPattern = [
    0, -4, -8, -12, -15, -17, -18, -19, -20, -23, -26, -28, -30, -31, -31, -30,
    -27, -23, -18, -23, -27, -31, -33, -34, -33, -31, -29, -26, -23, -20, -18,
    -19, -20, -19, -19, -18, -18, -18, -19, -19, -20, -19, -18, -20, -23, -26,
    -29, -31, -33, -34, -33, -31, -27, -23, -18, -23, -27, -30, -31, -31, -30,
    -28, -26, -23, -20, -19, -18, -17, -15, -12, -8, -4, 0,
];
var group1 = L.featureGroup();
var modeclick = 0;

//local variables
var size;
var xx, yy;
var chaine = "";

var omni;
var i, j;
var cst1;
var cst2;
var hpoint;
var delta;
var alpha;
var angle, ti, az;
var p1, p2;
var idist, jdist;
var jstep;
var istep;
var sobstacle;
var s;
var iobstacle;
var jobstacle;
var hmax;
var dobs;
var hvmax;
var hant;
var point;
var d1;
var d2;
var R1;
var v;
var LKE;
var LFS;
var L;
var bin = [];

var ant;
var circle;
var colors = [];
var start;

let cellHandoverMatrix = [];

//action after the selection of the south-east corner of the covering area
function placeCorner(location) {
    southCorner = location;

    var p3 = L.latLng(southCorner.lat + 0.001, southCorner.lng);
    var distance = L.GeometryUtil.length([location, p3]);
    //computaion of the latitude  diff equivalent to 10m
    latBin = (0.001 * 10) / distance;

    p3 = L.latLng(southCorner.lat, southCorner.lng + 0.001);
    var distance = L.GeometryUtil.length([location, p3]);
    //computaion of the longitude  diff equivalent to 10m
    lngBin = (0.001 * 10) / distance;

    document.getElementById("message").value = "Scan in progress !!!";
    areaWidth = parseInt(document.getElementById("areaWidth ").value);
    areaHeight = parseInt(document.getElementById("areaHeight ").value);
    document.getElementById("areaWidth ").disabled = "disabled";
    document.getElementById("areaHeight ").disabled = "disabled";
    //initialization of the relief, elevation,	and architecture tables
    for (i = 0; i < areaHeight; i++) {
        relief.push([]);
        for (j = 0; j < areaWidth; j++) relief[i].push(0);
    }
    for (i = 0; i < areaHeight; i++) {
        elevation.push([]);
        for (j = 0; j < areaWidth; j++) elevation[i].push(0);
    }
    for (i = 0; i < areaHeight; i++) {
        architecture.push([]);
        for (j = 0; j < areaWidth; j++) architecture[i].push(0);
    }

    for (i = 0; i < areaHeight; i++) {
        isOnTheRoad.push([]);
        for (j = 0; j < areaWidth; j++) {
            isOnTheRoad[i].push([]);
            isOnTheRoad[i][j] = false;
        }
    }
    orientation = [];
    for (i = 0; i < areaHeight; i++) {
        orientation.push([]);
        for (j = 0; j < areaWidth; j++) {
            orientation[i].push([]);
            orientation[i][j] = -1;
        }
    }

    scanArea();
}

function activate() {
    document.getElementById("btn").disabled = "";
}

var addantenna;
var line = 0;
let mainPolygonZone;

//scanArea function extract the elevation data of all the points in the deployment area (with a step=10m)
function scanArea() {
    mymap.addLayer(group1);

    //for each column in the current block
    for (col = 0; col < areaWidth; col++) {
        var location = L.latLng(
            southCorner.lat + line * latBin,
            southCorner.lng + col * lngBin
        );
        //relief[bl+line][bc+col]=getElevation2(location);
        var a = colorPicker.getColor(location);
        var h = NaN;
        if (a !== null) {
            //var h = (a[0] << 16) + (a[1] << 8) + a[2];
            //h = h === 0x800000 ? NaN : (h > 0x800000 ? h - 0x1000000 : h) / 100;
            h = -10000 + (a[0] * 256 * 256 + a[1] * 256 + a[2]) * 0.1;
        }
        relief[line][col] = h;
        //display the scanned bin
        var zonecontour = L.polygon([
            [location.lat, location.lng],
            [location.lat + latBin, location.lng],
            [location.lat + latBin, location.lng + lngBin],
            [location.lat, location.lng + lngBin],
        ]).addTo(group1);
    }
    line++;

    if (line < areaHeight) setTimeout("scanArea()", 10);
    else {
        //End of deployment area scanning

        document.getElementById("propag").disabled = "";
        document.getElementById("routes").disabled = "";
        document.getElementById("completer").disabled = "";
        document.getElementById("axes").disabled = "";
        document.getElementById("antenne").disabled = "";
        document.getElementById("batiment").disabled = "";
        document.getElementById("saveBat").disabled = "";
        document.getElementById("loadBat").disabled = "";
        document.getElementById("ecole").disabled = "";
        document.getElementById("createPath").disabled = "";
        document.getElementById("elevation").disabled = "";
        mymap.removeLayer(group1);
        // Display the deployment area
        mainPolygonZone = L.polygon([
            [southCorner.lat, southCorner.lng],
            [southCorner.lat + latBin * areaHeight, southCorner.lng],
            [
                southCorner.lat + latBin * areaHeight,
                southCorner.lng + lngBin * areaWidth,
            ],
            [southCorner.lat, southCorner.lng + lngBin * areaWidth],
        ]).addTo(mymap);

        document.getElementById("message").value = "Choisissez une action !";

        return;
    }
}

var markerantenna = [];

function placeAntennaConstructor(location, pow, type, tilt, azimut) {
    antenne = new AntennaConstructor(location, true);

    //if the antenna is added by a mousse click
    if (typeof type == "undefined") {
        if (document.getElementById("omni").checked) omni = true;
        else omni = false;
        antenne.omni = omni;
        antenne.tilt = document.getElementById("tilt").value;
        if (antenne.tilt != null) {
            tilt = (parseInt(antenne.tilt) * Math.PI) / 180;
            antenne.tilt = tilt;
        } else antenne.tilt = 0;
        if (!omni) {
            var az = document.getElementById("azimut").value;
            if (az != null) {
                azimut = (parseInt(az) * Math.PI) / 180;
                antenne.azimut = azimut;
            } else antenne.azimut = 0;
        }
        objpower = document.getElementById("power");
        antenne.power = parseInt(objpower.value);
    }
    //it is a restored antenna from stored data
    else {
        if (type == "omni") {
            omni = true;
            antenne.omni = omni;
            antenne.azimut = -1;
            antenne.tilt = tilt;
            antenne.power = pow;
        } else {
            omni = false;
            antenne.omni = omni;
            antenne.azimut = azimut;
            antenne.tilt = tilt;
            antenne.power = pow;
        }
    }
    //display the antenna
    //circle if it is an omni antenna
    if (omni == true) {
        var circle = L.circle([location.lat, location.lng], {
            color: "red",
            fillColor: "#f03",
            fillOpacity: 0.5,
            radius: 10,
        }).addTo(mymap);
        // Add the circle to the map.
        markerantenna.push(circle);
    }
    //a line if it is a directional antenna oriented according to the azimut parameter
    else {
        var arrow = L.polyline(
            [
                location,
                L.latLng(
                    location.lat + 2 * latBin * Math.sin(Math.PI / 2 - azimut),
                    location.lng + 2 * lngBin * Math.cos(Math.PI / 2 - azimut)
                ),
            ],
            {weight: 1, color: "red"}
        ).addTo(mymap);
        var arrow = L.circle([location.lat, location.lng], {
            color: "red",
            fillColor: "#f03",
            fillOpacity: 1,
            radius: 2,
        }).addTo(mymap);
    }
    antennas.push(antenne);
    nbantennas++;
    document.getElementById("message").value = "Choisissez une action !";
    frameantenna.style.visibility = "hidden";
}

//action when the radio propagation computing is required : click on the button
function propagation() {
    //avoid re-click on the button during the computation
    document.getElementById("propag").disable = "disabled";
    //normalize the elevation data
    if (firstpropag == true) {
        firstpropag = false;
        min = 10000;
        for (i = 0; i < areaHeight; i++)
            for (j = 0; j < areaWidth; j++)
                if (relief[i][j] < min) min = relief[i][j];
        for (i = 0; i < areaHeight; i++)
            for (j = 0; j < areaWidth; j++) relief[i][j] = relief[i][j] - min;
    }
    for (i = 0; i < areaHeight; i++) {
        for (j = 0; j < areaWidth; j++) {
            elevation[i][j] = relief[i][j] + architecture[i][j];
        }
    }
    power = [];
    for (a = 0; a < nbantennas; a++) {
        power.push([]);
        for (i = 0; i < areaHeight; i++) {
            power[a].push([]);
            for (j = 0; j < areaWidth; j++) {
                power[a][i].push([]);
                power[a][i][j] = -1000;
            }
        }
    }
    rep = document.getElementById("methode").value;
    if (document.getElementById("methode").value == "1") propagationSKE();
    else if (document.getElementById("methode").value == "2") propagationBull();
    else if (document.getElementById("methode").value == "3")
        propagationEpstein();
    else if (document.getElementById("methode").value == "8")
        propagationCostHata();
    else if (document.getElementById("methode").value == "9")
        propagationWalfisch();
    document.getElementById("cartepower").disabled = "";
    document.getElementById("carteinterference").disabled = "";
    document.getElementById("cartehandover").disabled = "";
    document.getElementById("carteCell").disabled = "";
    document.getElementById("carteresidence").disabled = "";
    document.getElementById("propag").disable = "";
}

//function returning an RGB color according to a given value p
function GetColor(p) {
    /*index=parseInt((50-p)*520/(50-qualityThreshold));
          r=colors[index][0];
          v=colors[index][1];
          b=colors[index][2];*/
    if (p > 0) {
        r = 251;
        v = 0;
        b = 0;
    } else if (p > -50) {
        r = 250;
        v = 123;
        b = 0;
    } else if (p > -70) {
        r = 251;
        v = 220;
        b = 0;
    } else if (p > -80) {
        r = 244;
        v = 251;
        b = 0;
    } else if (p > -90) {
        r = 188;
        v = 251;
        b = 0;
    } else if (p > -100) {
        r = 1;
        v = 250;
        b = 57;
    } else if (p > -105) {
        r = 0;
        v = 251;
        b = 201;
    } else if (p > -110) {
        r = 0;
        v = 207;
        b = 251;
    } else if (p > -115) {
        r = 1;
        v = 69;
        b = 250;
    } else {
        r = 51;
        v = 1;
        b = 250;
    }

    if (r < 16) strred = "0" + r.toString(16);
    else strred = r.toString(16);
    if (b < 16) strblue = "0" + b.toString(16);
    else strblue = b.toString(16);
    if (v < 16) strgreen = "0" + v.toString(16);
    else strgreen = v.toString(16);
    return "#" + strred + strgreen + strblue;
}

function propagationCostHata() {
    var p1 = L.latLng(southCorner.lat, southCorner.lng);
    var p2 = L.latLng(southCorner.lat + latBin, southCorner.lng);
    var binHeight = L.GeometryUtil.length([p1, p2]);
    p1 = L.latLng(southCorner.lat, southCorner.lng);
    p2 = L.latLng(southCorner.lat, southCorner.lng + lngBin);
    var binWidth = L.GeometryUtil.length([p1, p2]);

    qualityThreshold = parseInt(
        document.getElementById("qualityThreshold").value
    );
    frequencySpectrum = parseInt(
        document.getElementById("frequencySpectrum").value
    );
    cst1 = 1.56 * Math.log10(frequencySpectrum) + 0.8;
    cst2 = 46.3 + 33.9 * Math.log10(frequencySpectrum);

    for (a = 0; a < nbantennas; a++) {
        antennaLocation = antennas[a].location;
        point = L.latLng(antennaLocation.lat, antennaLocation.lng);
        tilt = antennas[a].tilt;
        tilt = (180 * tilt) / Math.PI;
        if (antennas[a].omni == false) {
            azimut = antennas[a].azimut;
            azimut = (180 * azimut) / Math.PI;
        }
        iant = Math.floor((antennaLocation.lat - southCorner.lat) / latBin);
        jant = Math.floor((antennaLocation.lng - southCorner.lng) / lngBin);
        hant = elevation[iant][jant] + 10;
        if (-200 < -iant) iinf = -iant;
        else iinf = -200;
        if (-200 < -jant) jinf = -jant;
        else jinf = -200;
        if (200 > areaHeight - iant) isup = areaHeight - iant;
        else isup = 200;
        if (200 > areaWidth - jant) jsup = areaWidth - jant;
        else jsup = 200;

        for (jdist = jinf; jdist <= jsup; jdist++)
            for (idist = iinf; idist <= isup; idist++) {
                ipoint = iant + idist; //coordonnées en maille d'un point de reception
                jpoint = jant + jdist;
                if (
                    ipoint < 0 ||
                    jpoint < 0 ||
                    ipoint >= areaHeight ||
                    jpoint >= areaWidth
                )
                    continue;
                point.lat = antennaLocation.lat + idist * latBin;
                point.lng = antennaLocation.lng + jdist * lngBin;
                d = L.GeometryUtil.length([antennaLocation, point]);
                if (idist == 0 && jdist == 0) {
                    //si c'est la position de l'antenne alors ignorer
                    Loss = 0;
                } else {
                    hpoint = elevation[ipoint][jpoint] + 1.5;
                    if (CCost == 3)
                        ahr =
                            3.2 * Math.log10(11.75 * hpoint) * Math.log10(11.75 * hpoint) -
                            4.97;
                    else
                        ahr = (1.1 * Math.log10(frequencySpectrum) - 0.7) * hpoint - cst1;

                    Loss = cst2 - 13.82 * Math.log10(hant);
                    Loss =
                        Loss -
                        ahr +
                        (44.9 - 6.55 * Math.log10(hant)) * Math.log10(d / 1000.0) +
                        CCost;

                    angle = (180 * Math.atan(Math.abs(hant - hpoint) / d)) / Math.PI;

                    angle = Math.abs(tilt - angle);

                    angleindex = Math.floor(angle / 5);
                    Loss = Loss + CCost - VertRadiationPattern[angleindex];

                    if (antennas[a].omni == false) {
                        if (idist == 0 && jdist > 0) angle = 90;
                        else if (idist == 0 && jdist < 0) angle = 270;
                        else {
                            angle = (180 * Math.atan(jdist / idist)) / Math.PI;
                            if (idist < 0) angle = angle + 180;
                            if (angle < 0) angle = angle + 360;
                        }
                        angle = Math.abs(angle - azimut);
                        angleindex = Math.floor(angle / 5);
                        Loss = Loss - HorzRadiationPattern[angleindex];
                    }
                }
                power[a][ipoint][jpoint] = antennas[a].power - Loss;
            }
    }
    document.getElementById("cartepower").enabled = "";
}

//Single Knife Edge propgation model
function propagationSKE() {
    //computation of the bin dimentions (10x10m)
    var p1 = L.latLng(southCorner.lat, southCorner.lng);
    var p2 = L.latLng(southCorner.lat + latBin, southCorner.lng);
    var binHeight = L.GeometryUtil.length([p1, p2]);
    p1 = L.latLng(southCorner.lat, southCorner.lng);
    p2 = L.latLng(southCorner.lat, southCorner.lng + lngBin);
    var binWidth = L.GeometryUtil.length([p1, p2]);
    //for each antenna
    for (a = 0; a < nbantennas; a++) {
        antennaLocation = antennas[a].location;
        point = L.latLng(antennaLocation.lat, antennaLocation.lng);
        //compute the coordinates of the bin where the antenna is located
        iant = Math.floor((antennaLocation.lat - southCorner.lat) / latBin);
        jant = Math.floor((antennaLocation.lng - southCorner.lng) / lngBin);
        //antenna elevation corresponds to the relief+architecture+10m
        hant = elevation[iant][jant] + 10;
        qualityThreshold = parseInt(
            document.getElementById("qualityThreshold").value
        );
        frequencySpectrum = parseInt(
            document.getElementById("frequencySpectrum").value
        );
        //convert the antenna tilt to rad
        tilt = antennas[a].tilt;
        tilt = (180 * tilt) / Math.PI;
        if (antennas[a].omni == false) {
            //convert the antenna azimut to rad
            azimut = antennas[a].azimut;
            azimut = (180 * azimut) / Math.PI;
        }
        //compute the area range for computing antenna received power
        if (-200 < -iant) iinf = -iant;
        else iinf = -200;
        if (-200 < -jant) jinf = -jant;
        else jinf = -200;
        if (200 > areaHeight - iant) isup = areaHeight - iant;
        else isup = 200;
        if (200 > areaWidth - jant) jsup = areaWidth - jant;
        else jsup = 200;
        //for each bin in the computation area arround the antenna
        for (var jdist = jinf; jdist <= jsup; jdist++)
            for (var idist = iinf; idist <= isup; idist++) {
                ipoint = iant + idist; //point's coordinates (in nb bins)
                jpoint = jant + jdist;
                if (
                    ipoint < 0 ||
                    jpoint < 0 ||
                    ipoint >= areaHeight ||
                    jpoint >= areaWidth
                )
                    continue;
                //compute the distance of the bin with the anetta
                point.lat = antennaLocation.lat + idist * latBin;
                point.lng = antennaLocation.lng + jdist * lngBin;
                //horizonal distance between the antenna and the reception point
                d = L.GeometryUtil.length([antennaLocation, point]);
                if (idist == 0 && jdist == 0) {
                    //if it is the antenna position then consider the LOS formulla
                    Loss =
                        32.4 +
                        20 *
                        Math.log10(
                            Math.sqrt(binWidth * binWidth + binHeight * binHeight) /
                            2 /
                            frequencySpectrum
                        ) +
                        20 * Math.log10(frequencySpectrum);
                } else {
                    //extract the point elevation
                    hpoint = elevation[ipoint][jpoint];
                    delta = hant - hpoint - 1.5; //difference between antenna and phone elevation

                    alpha; //horizontal angle in rad formed by EAST-Antenna-point
                    if (jdist != 0) {
                        alpha = Math.atan(idist / jdist);
                        if (idist < 0 && jdist < 0) alpha = alpha + 3.14;
                        else if (idist >= 0 && jdist < 0) alpha = alpha + 3.14;
                    } else {
                        if (idist > 0) alpha = 1.5707;
                        else alpha = -1.5707;
                    }

                    jstep = Math.cos(alpha); //sampling step of the horizonal line between the antenna and the reception point
                    istep = Math.sin(alpha);
                    distStepBin = Math.sqrt(
                        istep * istep * binHeight * binHeight +
                        jstep * jstep * binWidth * binWidth
                    );
                    iobstacle = Math.floor(iant + istep); //first obstacle
                    jobstacle = Math.floor(jant + jstep);

                    hmax = elevation[iobstacle][jobstacle]; //first obstacle elevation
                    dobs = distStepBin;
                    hvmax = hant - (dobs / d) * delta;
                    sobstacle = 1;
                    for (s = 1; Math.abs(s * istep) < Math.abs(idist); s++) {
                        //for each potential obstacle
                        dobs = s * distStepBin;
                        hv = hant - (dobs / d) * delta;

                        if (
                            elevation[Math.floor(iant + s * istep)][
                                Math.floor(jant + s * jstep)
                                ] -
                            hv >
                            hmax - hvmax
                        ) {
                            //if it is realy an obstacle and it is the heighest
                            hmax =
                                elevation[Math.floor(iant + s * istep)][
                                    Math.floor(jant + s * jstep)
                                    ]; //then store the obstacle
                            hvmax = hv;
                            iobstacle = Math.floor(iant + s * istep);
                            jobstacle = Math.floor(jant + s * jstep);
                            sobstcale = s;
                        }
                    }

                    LKE = 0.0;
                    hmax = hmax - hvmax;
                    //if the reception point is not in Light of Sight from the antenna
                    if (hmax > 0) {
                        //compute the mask effect attenuation
                        obstacle = L.latLng(
                            antennaLocation.lat + sobstacle * istep * latBin,
                            antennaLocation.lng + sobstacle * jstep * lngBin
                        );
                        d1 = L.GeometryUtil.length([antennaLocation, obstacle]);
                        d2 = L.GeometryUtil.length([point, obstacle]);
                        R1 = Math.sqrt((0.3 * d1 * d2) / (d1 + d2));
                        v = (hmax * Math.sqrt(2)) / R1;
                        if (v > 1) LKE = -20 * Math.log10(0.225 / v);
                    }
                    if (LKE < 0) LKE = 0.0;
                    //compute the free space attenuation
                    LFS =
                        32.4 +
                        20 * Math.log10(d / 1000.0) +
                        20 * Math.log10(frequencySpectrum);
                    //compute the total power lost (in dB)
                    Loss = LKE + LFS;
                    //compute the vertical angle between antenna tilt and direct line between antenna and point
                    angle = (180 * Math.atan(Math.abs(hant - hpoint) / d)) / Math.PI;

                    angle = tilt - angle;
                    if (angle < 0) angle = 360 + angle;
                    angleindex = Math.floor(angle / 5);
                    //add the vertical radiation attenuation
                    Loss = Loss + CCost - VertRadiationPattern[angleindex];

                    if (antennas[a].omni == false) {
                        if (idist == 0 && jdist > 0) angle = 90;
                        else if (idist == 0 && jdist < 0) angle = 270;
                        else {
                            angle = (180 * Math.atan(jdist / idist)) / Math.PI;
                            if (idist < 0) angle = angle + 180;
                            if (angle < 0) angle = angle + 360;
                        }
                        angle = Math.abs(angle - azimut);
                        angleindex = Math.floor(angle / 5);
                        //add the horizonal radiation attenuation
                        Loss = Loss - HorzRadiationPattern[angleindex];
                    }
                }
                //store the received signal power
                power[a][ipoint][jpoint] = antennas[a].power - Loss;
            }
    }
    document.getElementById("cartepower").enabled = "";
}

function propagationBull() {
    var p1 = L.latLng(southCorner.lat, southCorner.lng);
    var p2 = L.latLng(southCorner.lat + latBin, southCorner.lng);
    var binHeight = L.GeometryUtil.length([p1, p2]);
    p1 = L.latLng(southCorner.lat, southCorner.lng);
    p2 = L.latLng(southCorner.lat, southCorner.lng + lngBin);
    var binWidth = L.GeometryUtil.length([p1, p2]);

    qualityThreshold = parseInt(
        document.getElementById("qualityThreshold").value
    );
    frequencySpectrum = parseInt(
        document.getElementById("frequencySpectrum").value
    );

    for (a = 0; a < nbantennas; a++) {
        antennaLocation = antennas[a].location;
        point = L.latLng(antennaLocation.lat, antennaLocation.lng);
        iant = Math.floor((antennaLocation.lat - southCorner.lat) / latBin);
        jant = Math.floor((antennaLocation.lng - southCorner.lng) / lngBin);
        hant = elevation[iant][jant] + 10;
        tilt = antennas[a].tilt;
        if (-200 < -iant) iinf = -iant;
        else iinf = -200;
        if (-200 < -jant) jinf = -jant;
        else jinf = -200;
        if (200 > areaHeight - iant) isup = areaHeight - iant;
        else isup = 200;
        if (200 > areaWidth - jant) jsup = areaWidth - jant;
        else jsup = 200;
        for (var jdist = jinf; jdist <= jsup; jdist++)
            for (var idist = iinf; idist <= isup; idist++) {
                if (idist == 0 && jdist == 0) continue; //si c'est la position de l'antenne alors ignorer
                ipoint = iant + idist; //coordonnées en maille d'un point de reception
                jpoint = jant + jdist;
                if (
                    ipoint < 0 ||
                    jpoint < 0 ||
                    ipoint >= areaHeight ||
                    jpoint >= areaWidth
                )
                    continue;

                point.lat = antennaLocation.lat + idist * latBin;
                point.lng = antennaLocation.lng + jdist * lngBin;
                d = L.GeometryUtil.length([antennaLocation, point]);

                hpoint = elevation[ipoint][jpoint];
                delta = hant - hpoint - 1.5;

                alpha; //l'angle fait entre l'antenne, les latitudes et le point de reception
                if (jdist != 0) {
                    alpha = Math.atan(idist / jdist);
                    if (idist < 0 && jdist < 0) alpha = alpha + 3.14;
                    else if (idist >= 0 && jdist < 0) alpha = alpha + 3.14;
                } else {
                    if (idist > 0) alpha = 1.5707;
                    else alpha = -1.5707;
                }
                jstep = Math.cos(alpha); //pas d'avance sur la line directe entre l'antenne et le point de reception
                istep = Math.sin(alpha);
                distStepBin = Math.sqrt(
                    istep * istep * binHeight * binHeight +
                    jstep * jstep * binWidth * binWidth
                );
                stotal = Math.floor(d / distStepBin);
                s1 = 0;
                tangmax = 0;
                for (
                    s = 1;
                    Math.abs(s * istep) < Math.abs(idist) &&
                    Math.abs(s * jstep) < Math.abs(jdist);
                    s++
                ) {
                    //parcours des obstacle avec un pas istep, jstep
                    dobs = s * distStepBin;
                    hv = hant - (dobs / d) * delta;
                    hobs =
                        elevation[Math.floor(iant + s * istep)][
                            Math.floor(jant + s * jstep)
                            ];
                    if (hobs > hv && (hobs - hant) / dobs > tangmax) {
                        //si c'est l'obstacle le plus haut
                        tangmax = (hobs - hant) / dobs;
                        s1 = s;
                    }
                }

                s2 = 0;
                tangmax = 0;
                for (s = 1; Math.abs(s * istep) < Math.abs(idist); s++) {
                    //parcours des obstacle avec un pas istep, jstep
                    dobs = s * distStepBin;
                    hv = hpoint + 1.5 - (dobs / d) * delta;
                    hobs =
                        elevation[Math.floor(ipoint - s * istep)][
                            Math.floor(jpoint - s * jstep)
                            ];
                    if (hobs > hv && (hobs - hpoint) / dobs > tangmax) {
                        //si c'est l'obstacle le plus haut
                        tangmax = (hobs - hpoint) / dobs;
                        s2 = s;
                    }
                }
                var LBull = 0.0;
                sobs = 0;
                hobs = 0;
                if (s1 == 0 && s2 > 0) {
                    sobs = stotal - s2;
                    hobs =
                        elevation[Math.floor(ipoint - s2 * istep)][
                            Math.floor(jpoint - s2 * jstep)
                            ];
                }
                if (s1 > 0 && s2 == 0) {
                    sobs = s1;
                    hobs =
                        elevation[Math.floor(iant + s1 * istep)][
                            Math.floor(jant + s1 * jstep)
                            ];
                }
                if (s1 > 0 && s2 > 0) {
                    delta1 =
                        hant -
                        elevation[Math.floor(iant + s1 * istep)][
                            Math.floor(jant + s1 * jstep)
                            ];
                    delta2 =
                        hpoint +
                        1.5 -
                        elevation[Math.floor(ipoint - s2 * istep)][
                            Math.floor(jpoint - s2 * jstep)
                            ];
                    d1 = s1 * distStepBin;
                    d2 = s2 * distStepBin;
                    s3 = stotal - s2;
                    min = 1000.0;
                    for (s = s1; s <= s3; s++) {
                        dobs1 = s * distStepBin;
                        dobs2 = (stotal - s) * distStepBin;
                        if (
                            Math.abs(
                                hpoint +
                                1.5 -
                                (delta2 * dobs2) / d2 -
                                (hant - (delta1 * dobs1) / d1)
                            ) < min
                        ) {
                            min = Math.abs(
                                hpoint +
                                1.5 -
                                (delta2 * dobs2) / d2 -
                                (hant - (delta1 * dobs1) / d1)
                            );
                            sobs = s;
                            hobs = hpoint + 1.5 - (delta2 * dobs2) / d2;
                        }
                    }
                }
                if (s1 == 0 && s2 == 0) LBull = 0.0;
                else {
                    obstacle = new google.maps.LatLng(
                        antennaLocation.lat + sobs * istep * latBin,
                        antennaLocation.lng + sobs * jstep * lngBin
                    );
                    d1 = google.maps.geometry.spherical.computeDistanceBetween(
                        antennaLocation,
                        obstacle
                    );
                    d2 = google.maps.geometry.spherical.computeDistanceBetween(
                        point,
                        obstacle
                    );
                    R1 = Math.sqrt((0.3 * d1 * d2) / (d1 + d2));
                    hv = hant - (d1 / (d1 + d2)) * delta;
                    v = ((hobs - hv) * Math.sqrt(2)) / R1;
                    if (v > 1) LBull = -20 * Math.log10(0.225 / v);
                }
                if (LBull < 0) {
                    if (LBull < 0) LBull = 0.0;
                }
                LFS =
                    32.4 +
                    20 * Math.log10(d / 1000.0) +
                    20 * Math.log10(frequencySpectrum);

                L = LFS + LBull;
                angle = (180 * Math.atan(Math.abs(hant - hpoint) / d)) / Math.PI;

                angle = tilt - angle;
                if (angle < 0) angle = 360 + angle;
                angleindex = Math.floor(angle / 5);
                L = L + CCost - VertRadiationPattern[angleindex];

                if (antennas[a].omni == false) {
                    if (idist == 0 && jdist > 0) angle = 90;
                    else if (idist == 0 && jdist < 0) angle = 270;
                    else {
                        angle = (180 * Math.atan(jdist / idist)) / Math.PI;
                        if (idist < 0) angle = angle + 180;
                        if (angle < 0) angle = angle + 360;
                    }
                    angle = Math.abs(angle - azimut);
                    angleindex = Math.floor(angle / 5);
                    L = L - HorzRadiationPattern[angleindex];
                }

                power[a][ipoint][jpoint] = antennas[a].power - L;
            }
    }
    document.getElementById("cartepower").enabled = "";
}

function vider() {
    // console.log(bins);
    while (bins.length) {
        bins.pop().remove();
    }
}

function batiment() {
    document.getElementById("message").value =
        "Place the first corner of the building";
    modeclick = 3;

    document.getElementById("cartepower").disabled = "disabled";
    document.getElementById("carteinterference").disabled = "disabled";
    document.getElementById("cartehandover").disabled = "disabled";
    document.getElementById("carteCell").disabled = "disabled";
    document.getElementById("carteresidence").disabled = "disabled";
}

function displayElevation() {
    document.getElementById("message").value =
        "click  on the point for which you want know the elevation";
    modeclick = 4;
}

var batiments = [];
var axes = [];
var hautsBat = [];
var coinsBat = [];

function placeBat(location) {
    coinsBat.push(location);
}

function placeBat2(location) {
    coinsBat.push(location);
    bat = L.polygon(coinsBat, {
        fillColor: "grey",
        fillOpacity: 1,
        color: "transparent",
    }).addTo(mymap);
    batiments.push(bat);
    bat.on("dblclick", function (event) {
        rep = confirm("voulez vous supprimer le batiment");
        if (rep == true) {
            index = batiments.indexOf(this);
            for (i = 0; i < areaHeight; i++) {
                for (j = 0; j < areaWidth; j++) {
                    point = L.latLng(
                        southCorner.lat + i * latBin,
                        southCorner.lng + j * lngBin
                    );
                    if (this.getBounds().contains(point)) {
                        architecture[i][j] = 0;
                    }
                }
            }
            batiments.splice(index, 1);
            hautsBat.splice(index, 1);
            this.remove();
        }
    });
    bat.on("contextmenu", function (event) {
        index = batiments.indexOf(this);
        rep = alert("Hauteur du batiment : " + hautsBat[index] + " metres");
    });
    coinsBat = [];

    h = parseInt(prompt("Enter the height of the building in meters", "10"));

    for (i = 0; i < areaHeight; i++) {
        for (j = 0; j < areaWidth; j++) {
            point = L.latLng(
                southCorner.lat + i * latBin,
                southCorner.lng + j * lngBin
            );
            if (bat.getBounds().contains(point)) {
                architecture[i][j] = h;
            }
        }
    }
    hautsBat.push(h);
    document.getElementById("message").value = "Select an action !";
}

function addAntennaConstructor() {
    document.getElementById("message").value =
        "Place the antenna ! or Escap to cancel !";
    frameantenna.style.visibility = "visible";
    document.getElementById("omni").checked = true;
    modeclick = 1;

    document.getElementById("propag").disable = "disabled";
    document.getElementById("cartepower").disabled = "disabled";
    document.getElementById("carteinterference").disabled = "disabled";
    document.getElementById("cartehandover").disabled = "disabled";
    document.getElementById("carteCell").disabled = "disabled";
    document.getElementById("carteresidence").disabled = "disabled";
}

function carteCell() {
    vider();
    qualityThreshold = parseInt(
        document.getElementById("qualityThreshold").value
    );
    southCornerlat = southCorner.lat;
    southCornerlng = southCorner.lng;
    var a = 0;
    for (i = 0; i < areaHeight; i++) {
        for (j = 0; j < areaWidth; j++) {
            max = -1000;
            bestant = -1;
            for (a = 0; a < nbantennas; a++) {
                if (power[a][i][j] > max) {
                    max = power[a][i][j];
                    bestant = a;
                }
            }
            if (max < qualityThreshold) continue;
            plat = southCornerlat + i * latBin;
            plng = southCornerlng + j * lngBin;

            r = (bestant * 82) % 213;
            v = (bestant * 17) % 207;
            b = ((bestant * 87) % 107) + 107;
            if (r < 16) strred = "0" + r.toString(16);
            else strred = r.toString(16);
            if (b < 16) strblue = "0" + b.toString(16);
            else strblue = b.toString(16);
            if (v < 16) strgreen = "0" + v.toString(16);
            else strgreen = v.toString(16);
            couleur = "#" + strred + strgreen + strblue;

            var bin = L.polygon(
                [
                    [plat, plng],
                    [plat + latBin, plng],
                    [plat + latBin, plng + lngBin],
                    [plat, plng + lngBin],
                ],
                {fillColor: couleur, fillOpacity: 1, color: "transparent"}
            ).addTo(mymap);
            bins.push(bin);
        }
    }
}

function choixenv() {
    m = document.getElementById("methode").value;
    if (m == 8) {
        rep = confirm("Est un environnement urbain ?");
        if (rep == true) CCost = 3;
        else CCost = 0;
    }
    document.getElementById("propag").disable = "disabled";
    document.getElementById("cartepower").disabled = "disabled";
    document.getElementById("carteinterference").disabled = "disabled";
    document.getElementById("cartehandover").disabled = "disabled";
    document.getElementById("carteCell").disabled = "disabled";
    document.getElementById("carteresidence").disabled = "disabled";
}

function choixcarto() {
    rep = confirm("Transparent pour les zones hors qualityThresholds ?");
    if (rep == true) carto = true;
    else carto = false;
}

function cartepower() {
    vider();
    qualityThreshold = parseInt(
        document.getElementById("qualityThreshold").value
    );
    southCornerlat = southCorner.lat;
    southCornerlng = southCorner.lng;
    for (i = 0; i < areaHeight; i++) {
        for (j = 0; j < areaWidth; j++) {
            max = -1000;
            for (var a = 0; a < nbantennas; a++) {
                if (power[a][i][j] > max) max = power[a][i][j];
            }
            if (max < qualityThreshold) continue;
            plat = southCornerlat + i * latBin;
            plng = southCornerlng + j * lngBin;
            couleur = GetColor(Math.floor(max));
            var bin = L.polygon(
                [
                    [plat, plng],
                    [plat + latBin, plng],
                    [plat + latBin, plng + lngBin],
                    [plat, plng + lngBin],
                ],
                {fillColor: couleur, fillOpacity: 1, weight: 0, color: "none"}
            ).addTo(mymap);
            bins.push(bin);
        }
    }
}

function carteinterference() {
    vider();
    qualityThreshold = parseInt(
        document.getElementById("qualityThreshold").value
    );
    for (i = 0; i < areaHeight; i++) {
        for (j = 0; j < areaWidth; j++) {
            max = -1;
            suminterf = Math.pow(10, -15);
            for (var a = 0; a < nbantennas; a++) {
                if (Math.pow(10, power[a][i][j] / 10.0) > max) {
                    if (max != -1) suminterf += max;
                    max = Math.pow(10, power[a][i][j] / 10.0);
                } else suminterf += Math.pow(10, power[a][i][j] / 10.0);
            }
            CIR = max / suminterf;
            if (CIR > 1.5) continue;
            else if (CIR > 1) {
                r = 1;
                v = 69;
                b = 250;
            } else if (CIR > 0.5) {
                r = 1;
                v = 250;
                b = 57;
            } else if (CIR > 0.33) {
                r = 188;
                v = 251;
                b = 0;
            } else if (CIR > 0.25) {
                r = 244;
                v = 251;
                b = 0;
            } else if (CIR > 0.2) {
                r = 251;
                v = 220;
                b = 0;
            } else {
                r = 250;
                v = 123;
                b = 0;
            }

            if (r < 16) strred = "0" + r.toString(16);
            else strred = r.toString(16);
            if (b < 16) strblue = "0" + b.toString(16);
            else strblue = b.toString(16);
            if (v < 16) strgreen = "0" + v.toString(16);
            else strgreen = v.toString(16);
            couleur = "#" + strred + strgreen + strblue;

            plat = southCorner.lat + i * latBin;
            plng = southCorner.lng + j * lngBin;

            var bin = L.polygon(
                [
                    [plat, plng],
                    [plat + latBin, plng],
                    [plat + latBin, plng + lngBin],
                    [plat, plng + lngBin],
                ],
                {fillColor: couleur, fillOpacity: 1, color: "transparent"}
            ).addTo(mymap);
            bins.push(bin);
        }
    }
}

function getElevation(location) {
    // make API request
    /*var query =
            'https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery/' +
            location.lng +
            ',' +
            location.lat +
            '.json?layers=contour&limit=50&access_token=' +
            'pk.eyJ1IjoiaG1hYmVkIiwiYSI6ImNrbzhtdHZ3MDBtaGkybm1xbGc5OGR1dTkifQ.V0tUwrR-NO6M6dXLKXycAw';

            $.ajax({
                method: 'GET',
                url: query,
            success: function(data) {
                      // Get all the returned features
                    var allFeatures = data.features;
                    // Create an empty array to add elevation data to
                    var elevations = [];
                    // For each returned feature, add elevation data to the elevations array
                    for (i = 0; i < allFeatures.length; i++) {
                      elevations.push(allFeatures[i].properties.ele);
                    }
                    // In the elevations array, find the largest value
                    var highestElevation = Math.max(...elevations);
                    // Display the largest elevation value
                    document.getElementById('message').value="Elevation is " + highestElevation ;
                 }
            });*/
    var a = colorPicker.getColor(location);
    var h = NaN;
    if (a !== null) {
        //var h = (a[0] << 16) + (a[1] << 8) + a[2];
        //h = h === 0x800000 ? NaN : (h > 0x800000 ? h - 0x1000000 : h) / 100;
        h = -10000 + (a[0] * 256 * 256 + a[1] * 256 + a[2]) * 0.1;
        document.getElementById("message").value = "Elevation is " + h;
    }
}

function getElevation2(location) {
    // make API request
    var query =
        "https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery/" +
        location.lng +
        "," +
        location.lat +
        ".json?layers=contour&limit=50&access_token=" +
        "pk.eyJ1IjoiaG1hYmVkIiwiYSI6ImNrbzhtdHZ3MDBtaGkybm1xbGc5OGR1dTkifQ.V0tUwrR-NO6M6dXLKXycAw";

    $.ajax({
        method: "GET",
        url: query,
        success: function (data) {
            // Get all the returned features
            var allFeatures = data.features;
            // Create an empty array to add elevation data to
            var elevations = [];
            // For each returned feature, add elevation data to the elevations array
            for (i = 0; i < allFeatures.length; i++) {
                elevations.push(allFeatures[i].properties.ele);
            }
            // In the elevations array, find the largest value
            var highestElevation = Math.max(...elevations);
            return highestElevation;
        },
    });
}

function onMapClick(e) {
    // console.log("You clicked the map at " + e.latlng);
    // console.log(modeclick);
    if (modeclick == 0) {
        modeclick = 2;
        placeCorner(e.latlng);
    } else if (modeclick == 1) {
        modeclick = 2;
        placeAntennaConstructor(e.latlng, 0);
    } else if (modeclick == 3) {
        placeBat(e.latlng);
    } else if (modeclick == 4) {
        getElevation(e.latlng);
    } else if (modeclick == 5) {
        createPathPoint(e.latlng);
    }
}

function onMapDbClick(e) {
    if (modeclick == 3) {
        modeclick = 2;
        placeBat2(e.latlng);
    }
}

//code written by students
function propagationEpstein() {
    // console.log("Propagation Epstein");

    let generateFormula = (p1, p2) => {
        let distance = compute2DDistance(p1.i, p1.j, p2.i, p2.j);
        return genericStraightLineFormula(
            0,
            p1.hAbsolute + p1.offset,
            distance,
            p2.hAbsolute + p2.offset
        );
    };
    let computeRealDistance = (p1, p2, distance) => {
        let dx = compute2DDistance(p1.i, p1.j, p2.i, p2.j);
        let dy = p2.hAbsolute + p2.offset - (p1.hAbsolute + p1.offset);
        return Math.sqrt(dx * dx + dy * dy);
    };

    // Récuperation de la fréquence utilisée.
    frequencySpectrum = parseInt(
        document.getElementById("frequencySpectrum").value
    );

    // Calcul pour chacune des antennes.
    for (a = 0; a < nbantennas; a += 1) {
        // Récuperation de la position de l'antenne.
        antennaLocation = antennas[a].location;
        point = L.latLng(antennaLocation.lat, antennaLocation.lng);

        // Récuperation de l'angle de l'antenne.
        tilt = antennas[a].tilt;
        tilt = (180 * tilt) / Math.PI;

        // Changement de l'angle en fonction du type d'antenne.
        if (antennas[a].omni == false) {
            azimut = antennas[a].azimut;
            azimut = (180 * azimut) / Math.PI;
        }

        // Récuperation de l'index de l'antenne dans la grille.
        iant = Math.floor((antennaLocation.lat - southCorner.lat) / latBin);
        jant = Math.floor((antennaLocation.lng - southCorner.lng) / lngBin);

        // Récuperation de la hauteur de l'antenne.
        hant = elevation[iant][jant] + 10;

        // Création des bornes pour la zone à analyser.
        if (-200 < -iant) iinf = -iant;
        else iinf = -200;
        if (-200 < -jant) jinf = -jant;
        else jinf = -200;

        if (200 > areaHeight - iant) isup = areaHeight - iant;
        else isup = 200;
        if (200 > areaWidth - jant) jsup = areaWidth - jant;
        else jsup = 200;

        // console.log("frequencySpectrum : " + frequencySpectrum);

        // Analyse de la zone.
        for (jdist = jinf; jdist <= jsup; jdist += 1) {
            for (idist = iinf; idist <= isup; idist += 1) {
                // Démarrage avec une perte de 0.
                Loss = 0;

                // Récuperation de l'index réel de la case pour le tableau.
                ipoint = iant + idist;
                jpoint = jant + jdist;

                // Si l'index se trouve hors de la zone d'analyse
                if (
                    ipoint < 0 ||
                    jpoint < 0 ||
                    ipoint >= areaHeight ||
                    jpoint >= areaWidth
                ) {
                    // Alors la boucle s'arrête là.
                    continue;
                }

                // Récuperation de la position et de la hauteur de la case.
                point.lat = antennaLocation.lat + idist * latBin;
                point.lng = antennaLocation.lng + jdist * lngBin;
                d = L.GeometryUtil.length([antennaLocation, point]);

                // Si la case n'est pas celle de l'atenne.
                if (!(idist == 0 && jdist == 0)) {
                    // Récuperation de la liste des obstacles entre le mobile et l'antenne.
                    let pointList = getObstaclesList(iant, jant, ipoint, jpoint);

                    // Ajout des deux points importants
                    pointList.splice(0, 0, {
                        i: iant,
                        j: jant,
                        hAbsolute: elevation[iant][jant],
                        offset: 10,
                    });
                    pointList.push({
                        i: ipoint,
                        j: jpoint,
                        hAbsolute: elevation[ipoint][jpoint],
                        offset: 1.5,
                    });

                    // Calcul de la perte entre chacun des obstacles.
                    for (var index = 0; index < pointList.length - 1; index += 1) {
                        // Sont les deux points entre lesquelles calculé les pertes.
                        let p2 = pointList[index];
                        let p3 = pointList[index + 1];

                        /*
                                        // Free Space Loss
                                        {
                                            // Calcul de la distance réel entre les deux points
                                            let dVolOiseau = compute2DDistance(p2.i, p2.j, p3.i, p3.j);
                                            let dh = (elevation[Math.round(p3.i)][Math.round(p3.j)] + p3.offset) - (elevation[Math.round(p2.i)][Math.round(p2.j)] + p2.offset);
                                            let dReel = Math.sqrt((dVolOiseau * dVolOiseau) + (dh * dh));

                                            // Ajout de la perte en espace libre
                                            let freeSpaceLoss = freeSpacePropagationLoss(dReel, frequencySpectrum);
                                            Loss += -freeSpaceLoss;
                                        }
                                        */

                        // Calcul de la difraction
                        {
                            if (index == 0) {
                                continue;
                            }

                            let p1 = pointList[index - 1];

                            let formulaP1P3 = generateFormula(p1, p3);

                            let distanceP1P2 = compute2DDistance(p1.i, p1.j, p2.i, p2.j);
                            let dHeightP2StraightLine = computeDYFromFormula(
                                p2.hAbsolute,
                                p2.offset,
                                distanceP1P2,
                                formulaP1P3
                            );

                            let distanceHP1P2 = computeRealDistance(p1, p2, distanceP1P2);
                            let distanceP2P3 = compute2DDistance(p2.i, p2.j, p3.i, p3.j);
                            let distanceHP2P3 = computeRealDistance(p2, p3, distanceP2P3);

                            let lossDifract = computeDiffractionLoss(
                                dHeightP2StraightLine,
                                distanceHP1P2,
                                distanceHP2P3,
                                frequencySpectrum
                            );

                            Loss += lossDifract;
                        }
                    }
                }

                power[a][ipoint][jpoint] = antennas[a].power + Loss;
            }
        }
    }

    // Activation du bouton pour afficher l'heat map calculé.
    document.getElementById("cartepower").enabled = "";
}

function compute2DDistance(iCellStart, jCellStart, iCellEnd, jCellEnd) {
    return Math.sqrt(
        Math.pow((iCellEnd - iCellStart) * 10, 2) +
        Math.pow((jCellEnd - jCellStart) * 10, 2)
    );
}

function getObstaclesList(iCellStart, jCellStart, iCellEnd, jCellEnd) {
    const start = {
        i: iCellStart,
        j: jCellStart,
        hAbsolute: elevation[iCellStart][jCellStart] + 10,
    };
    const end = {
        i: iCellEnd,
        j: jCellEnd,
        hAbsolute: elevation[iCellEnd][jCellEnd] + 1.5,
    };

    // Créer ligne droite entre Antenne et Mobile
    var lastObstacle = {i: start.i, j: start.j};
    var distance = compute2DDistance(start.i, start.j, end.i, end.j);
    var lastObstacleFormula = createStraightLineFormula(
        start.i,
        start.j,
        start.hAbsolute,
        end.i,
        end.j,
        end.hAbsolute,
        distance
    );

    // Récuperer les points
    // --> getListPoint
    var points = getListPoint(start.i, start.j, end.i, end.j);
    var obstacles = [];

    // Tester un a un les points pour trouver les obstacles.
    // --> Si le point est plus haut que la ligne entre dernier obstacle et le mobile, ajouter dans la liste
    //			-> Modifier lastObstacleFormula
    for (var i = 0; i < points.length; i++) {
        var p = points[i];

        distance = compute2DDistance(
            lastObstacle.i,
            lastObstacle.j,
            Math.round(p.i),
            Math.round(p.j)
        );
        var h = computeDYFromFormula(
            p.hAbsolute,
            p.offset,
            distance,
            lastObstacleFormula
        );

        if (h > 0) {
            p.offset = 0;
            obstacles.push(p);
            lastObstacle.i = p.i;
            lastObstacle.j = p.j;
            distance = compute2DDistance(p.i, p.j, end.i, end.j);
            lastObstacleFormula = createStraightLineFormula(
                p.i,
                p.j,
                p.hAbsolute,
                end.i,
                end.j,
                end.hAbsolute,
                distance
            );
        }
    }

    if (obstacles.length == 0) {
        return obstacles;
    }

    // Tester un à un les obstacles entre eux pour supprimer les non nécessaires.
    // --> Si un point supprime un autre, alors le réutiliser
    // Réaliser ce test jusqu'à ce qu'aucun point ne se supprime lors de la boucle.
    while (true) {
        var obstaclesToKeep = [];
        var previousPoint = start;
        var nextPoint = obstacles.length == 1 ? end : obstacles[1];

        for (var i = 0; i < obstacles.length; i++) {
            // We draw a line between the previous point and the next one.
            distance = compute2DDistance(
                previousPoint.i,
                previousPoint.j,
                nextPoint.i,
                nextPoint.j
            );
            lastObstacleFormula = createStraightLineFormula(
                previousPoint.i,
                previousPoint.j,
                previousPoint.hAbsolute,
                nextPoint.i,
                nextPoint.j,
                nextPoint.hAbsolute,
                distance
            );

            // Now we calculate h, to know if the current point is needed or not.
            const p = obstacles[i];
            distance = compute2DDistance(previousPoint.i, previousPoint.j, p.i, p.j);
            var h = computeDYFromFormula(
                p.hAbsolute,
                p.offset,
                distance,
                lastObstacleFormula
            );

            if (h > 0) {
                obstaclesToKeep.push(p);
                previousPoint = p;
            }

            // We don't change previousPoint if not needed. It basically is
            // the last point in obstaclesToKeep.

            nextPoint = i == obstacles.length - 1 ? end : obstacles[i + 1];
        }

        if (obstacles.length == obstaclesToKeep.length) {
            break;
        }

        obstacles = obstaclesToKeep;
    }

    return obstacles;
}

function getListPoint(iCellStart, jCellStart, iCellEnd, jCellEnd) {
    let diffI = iCellEnd - iCellStart;
    let diffJ = jCellEnd - jCellStart;
    var points = [];

    var cellFormula;
    var start = 0;
    var stop;
    var increment = 0;
    var addPoint;

    if (Math.abs(diffI) > Math.abs(diffJ)) {
        cellFormula = genericStraightLineFormula(
            iCellStart,
            jCellStart,
            iCellEnd,
            jCellEnd
        );
        addPoint = (i, j, h, p) => {
            p.push({i: i, j: j, hAbsolute: h, offset: 0});
        };
        if (diffI > 0) {
            // UP
            start = iCellStart + 1;
            stop = (i) => {
                return i < iCellEnd;
            };
            increment = 1;
        } else {
            // DOWN
            start = iCellStart - 1;
            stop = (i) => {
                return i > iCellEnd;
            };
            increment = -1;
        }
    } else {
        cellFormula = genericStraightLineFormula(
            jCellStart,
            iCellStart,
            jCellEnd,
            iCellEnd
        );
        addPoint = (i, j, h, p) => {
            p.push({i: j, j: i, hAbsolute: h, offset: 0});
        };
        if (diffJ > 0) {
            // RIGHT
            start = jCellStart + 1;
            stop = (j) => {
                return j < jCellEnd;
            };
            increment = 1;
        } else {
            // LEFT
            start = jCellStart - 1;
            stop = (j) => {
                return j > jCellEnd;
            };
            increment = -1;
        }
    }

    for (var i = start; stop(i); i += increment) {
        let j = computeY(i, cellFormula);
        let jUp = Math.ceil(j);
        let jDown = Math.floor(j);

        if (jUp == jDown) {
            addPoint(i, jUp, elevation[Math.round(i)][Math.round(jUp)], points);
        } else {
            let formulaInterpollation = genericStraightLineFormula(
                jUp,
                elevation[i][jUp],
                jDown,
                elevation[i][jDown]
            );
            addPoint(i, j, computeY(j, formulaInterpollation), points);
        }
    }

    return points;
}

/**
 * Permet de calculer la formule d'une ligne droite en fonction de la cellule 1 et de la cellule 2.
 */
function createStraightLineFormula(
    iCell1,
    jCell1,
    offset1,
    iCell2,
    jCell2,
    offset2,
    distance
) {
    let i1 = Math.max(0, Math.round(iCell1));
    let j1 = Math.max(0, Math.round(jCell1));
    let i2 = Math.max(0, Math.round(iCell2));
    let j2 = Math.max(0, Math.round(jCell2));

    var hCell1 = elevation[i1][j1] + offset1;
    var hCell2 = elevation[i2][j2] + offset2;

    return genericStraightLineFormula(0, hCell1, distance, hCell2);
}

/**
 * Permet de calculer la distance entre deux cellules hauteur comprise.
 */
function computeDistanceBetweenTwoCells(
    iCell1,
    jCell1,
    offset1,
    iCell2,
    jCell2,
    offset2,
    distance
) {
    let i1 = Math.max(0, Math.round(iCell1));
    let j1 = Math.max(0, Math.round(jCell1));
    let i2 = Math.max(0, Math.round(iCell2));
    let j2 = Math.max(0, Math.round(jCell2));

    var hCell1 = elevation[i1][j1] + offset1;
    var hCell2 = elevation[i2][j2] + offset2;

    var dy = hCell2 - hCell1;
    var dx = distance;

    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Permet de calculer la différence entre la droite et la cellule actuelle.
 */
function computeDYFromFormula(height, offset, distance, formula) {
    var hCell = height + offset;
    var hLine = computeY(distance, formula);

    return hLine - hCell;
}

function computeY(x, formula) {
    return formula.m * x + formula.p;
}

/**
 * Méthode générique pour calaculer la formule entre deux points.
 */
function genericStraightLineFormula(x1, y1, x2, y2) {
    var m = (y2 - y1) / (x2 - x1);
    var p = y1 - x1 * m;

    return {m: m, p: p};
}

/**
 * Permet de calculer la perte de propagation en espace libre.
 */
function freeSpacePropagationLoss(distance, wavelength) {
    //return 0;
    return 20 * Math.log10(wavelength / (Math.PI * 4 * distance));
}

/**
 * Permet de calculer la perte par difraction suivant le model Epstein.
 */
function computeDiffractionLoss(height, distanceD1, distanceD2, wavelength) {
    let vNominateur = 2 * (distanceD1 * distanceD2);
    let vDenominateur = wavelength * distanceD1 * distanceD2;
    let v = height * Math.sqrt(vNominateur / vDenominateur);

    if (v <= -1) {
        return 0;
    } else if (v <= 0) {
        return 20 * Math.log10(0.5 - 0.62 * v);
    } else if (v <= 1) {
        return 20 * Math.log10(0.5 * Math.exp(-0.95 * v));
    } else if (v <= 2.4) {
        return (
            20 * Math.log10(0.4 - Math.sqrt(0.1184 - Math.pow(-0.1 * v + 0.38, 2)))
        );
    } else {
        return 20 * Math.log10(0.225 / v);
    }
}

// cellHandoverMatrix reset function
function resetCellHandoverMatrix() {
    // reset cellHandoverMatrix fill with -1 width = areaWidth height = areaHeight
    cellHandoverMatrix = [];
    for (let i = 0; i < areaHeight; i++) {
        cellHandoverMatrix[i] = [];
        for (let j = 0; j < areaWidth; j++) {
            cellHandoverMatrix[i][j] = -1;
        }
    }
}

// on handover click it should show where the handover should happen
function mapHandover() {
    vider();
    qualityThreshold = parseInt(
        document.getElementById("qualityThreshold").value
    );

    // reset cellHandoverMatrix
    resetCellHandoverMatrix();

    let southCornerLat = southCorner.lat;
    let southCornerLng = southCorner.lng;
    let plat;
    let plng;
    let colorToSet;

    for (i = 0; i < areaHeight; i++) {
        for (j = 0; j < areaWidth; j++) {
            //create array with nbantennas.length filled with -1000
            let maxList = new Array(nbantennas).fill(-1000);
            for (let a = 0; a < nbantennas; a++) {
                if (power[a][i][j] > maxList[a]) maxList[a] = power[a][i][j];
            }
            // check if the max is smaller than the threshold
            let validMax = 0;
            let max = -1000;
            for (let ind = 0; ind < maxList.length; ind++) {
                // find the biggest value
                if (maxList[ind] > qualityThreshold) {
                    if (maxList[ind] > max) {
                        max = maxList[ind];

                        //fill the cellHandoverMatrix with the antenna index
                        cellHandoverMatrix[i][j] = ind;
                    }
                    validMax++;
                }
            }
            if (validMax === 0) {
                continue;
            } else if (validMax === 1) {
                colorToSet = "rgba(40,50,255,0.69)";
            } else {
                colorToSet = "rgba(88,235,88,0.67)";
            }
            plat = southCornerLat + i * latBin;
            plng = southCornerLng + j * lngBin;
            const bin = L.polygon(
                [
                    [plat, plng],
                    [plat + latBin, plng],
                    [plat + latBin, plng + lngBin],
                    [plat, plng + lngBin],
                ],
                {fillColor: colorToSet, fillOpacity: 1, weight: 0, color: "none"}
            ).addTo(mymap);
            bins.push(bin);
        }
    }
}

function togglePauseMobileMovementButton(showIt) {
    // check pauseMobileMovement button has path-action-visible class and remove it
    if (document.getElementById("pauseMobileMovement").classList.contains("path-action-visible") && !showIt) {
        document.getElementById("pauseMobileMovement").classList.remove("path-action-visible");
    }
    // check pauseMobileMovement button has path-action-visible class and add it
    if (!document.getElementById("pauseMobileMovement").classList.contains("path-action-visible") && showIt) {
        document.getElementById("pauseMobileMovement").classList.add("path-action-visible");
    }
}

function toggleStartMobileMovementButton(showIt) {
    // check startMobileMovement button has path-action-visible class and remove it
    if (document.getElementById("startMobileMovement").classList.contains("path-action-visible") && !showIt) {
        document.getElementById("startMobileMovement").classList.remove("path-action-visible");
    }
    // check startMobileMovement button has path-action-visible class and add it
    if (!document.getElementById("startMobileMovement").classList.contains("path-action-visible") && showIt) {
        document.getElementById("startMobileMovement").classList.add("path-action-visible");
    }
}

function onCratePathClick() {
    modeclick = 5;

    toggleStartMobileMovementButton(false);
    togglePauseMobileMovementButton(false);

    //add vissible class to additional buttons
    document
        .getElementById("finishPathCreation")
        .classList.add("path-action-visible");
    document
        .getElementById("cancelPathCreation")
        .classList.add("path-action-visible");

    // add class to createPath button
    document.getElementById("createPath").classList.add("pulse-button");

    // clear old data if any
    clearPathCreationSetUp();
    //start creation process
    pathCreationInprogress = true;

}

// setup for path creation
let pathScreenGroup;
let pathPolylinePoints = [];
let pathPolyline;
let startPointMobile;
let pathCreationInprogress = false;
let isRestarting = false;
let isPaused = false;
let currentCheckPointIndex;

function createPathPoint(location) {
    // check if not out of polygon bounds
    if (isPointInPolygon(location, mainPolygonZone)) {
        // add the point to the polyline points array
        pathPolylinePoints.push([location.lat, location.lng]);

        // enable the finish path creation button
        if (
            pathPolylinePoints.length > 1 &&
            document.getElementById("finishPathCreation").disabled
        ) {
            document.getElementById("finishPathCreation").disabled = false;
        }

        //check if the polyline already exists
        if (pathPolylinePoints.length === 1) {
            // initialize the pathScreenGroup
            pathScreenGroup = new L.LayerGroup().addTo(mymap);

            // create a marker as start point
            var mobileMarker = L.icon({
                iconUrl: "mobile.png",

                iconSize: [20, 20], // size of the icon
                iconAnchor: [10, 10], // point of the icon which will correspond to marker's location
            });
            //add marker to the map
            startPointMobile = L.marker([location.lat, location.lng], {
                icon: mobileMarker,
            });
            pathScreenGroup.addLayer(startPointMobile);

            // create a polyline
            pathPolyline = L.polyline(pathPolylinePoints);
            pathScreenGroup.addLayer(pathPolyline);
        } else {
            pathPolyline.addLatLng([location.lat, location.lng]);
        }
    }
}

function isPointInPolygon(location, polygon) {
    // check if not out of polygon bounds
    if (
        location.lat > polygon.getBounds().getNorth() ||
        location.lat < polygon.getBounds().getSouth() ||
        location.lng > polygon.getBounds().getEast() ||
        location.lng < polygon.getBounds().getWest()
    ) {
        return false;
    } else {
        return true;
    }
}

function finishPathCreation() {
    pathCreationInprogress = false;
    modeclick = 2;

    //remove vissible class from additional buttons
    document
        .getElementById("finishPathCreation")
        .classList.remove("path-action-visible");
    document
        .getElementById("cancelPathCreation")
        .classList.remove("path-action-visible");

    // remove class to createPath button
    document.getElementById("createPath").classList.remove("pulse-button");

    // show startMobileMovement button
    toggleStartMobileMovementButton(true);
}

function cancelPathCreation() {
    clearPathCreationSetUp();
    finishPathCreation();
}

function clearPathCreationSetUp() {
    pathPolylinePoints = [];
    // clear pathScreenGroup
    if (pathScreenGroup) pathScreenGroup.clearLayers();

    // clear pathPolyline
    if (pathPolyline) pathPolyline = null;

    // clear startPointMobile
    if (startPointMobile) startPointMobile = null;
}

// timer for mobile movement
function timer(ms) {
    return new Promise((res) => setTimeout(res, ms));
}

// calculate the total distance of pathPolylinePoints
function getPathLength() {
    let totalDistance = 0;
    for (let i = 0; i < pathPolylinePoints.length - 1; i++) {
        let dx = pathPolylinePoints[i][0] - pathPolylinePoints[i + 1][0];
        let dy = pathPolylinePoints[i][1] - pathPolylinePoints[i + 1][1];
        totalDistance += Math.sqrt(dx * dx + dy * dy);
    }
    return totalDistance;
}

// function that gets the index of the cell that is closest to the mobile position
function getCellIndex(location) {
    let southCornerLat = southCorner.lat;
    let southCornerLng = southCorner.lng;
    for (let i = 0; i < cellHandoverMatrix.length; i++) {
        for (let j = 0; j < cellHandoverMatrix[i].length; j++) {
            let plat = southCornerLat + i * latBin;
            let plng = southCornerLng + j * lngBin;
            let temPolygon = L.polygon([
                [plat, plng],
                [plat + latBin, plng],
                [plat + latBin, plng + lngBin],
                [plat, plng + lngBin],
            ]);

            // check if the location is in the polygon
            if (isPointInPolygon(location, temPolygon)) {
                // return antenna index
                return cellHandoverMatrix[i][j];
            }
        }
    }
}

// move the mobile marker with a constant speed  through the pathPolylinePoints
async function startMobileMovement() {
    // initial checkpoint currentCheckPointIndex
    currentCheckPointIndex = 0;
    // check if marker already moving stop it and reposition
    if (!isRestarting) {
        //set isRestarting to true
        isRestarting = true;
        // move the marker to the start point
        await timer(500);
        startPointMobile.setLatLng([
            pathPolylinePoints[0][0],
            pathPolylinePoints[0][1],
        ]);
    }
    // show togglePauseMobileMovementButton
    togglePauseMobileMovementButton(true);
    // start marker moving
    isRestarting = false;
    isPaused = false;

    // move the marker
    await moveMobile()
}

// move mobile function
async function moveMobile() {
    // create a line connecting the mobile to antenna
    let mobileToAntennaLine;
    // calculate the avarage speed
    let time = 300;
    let avgSpeed = getPathLength() / time;
    // check if the mobile marker is not already at the end of the path
    while (
        startPointMobile.getLatLng().lat !==
        pathPolylinePoints[pathPolylinePoints.length - 1][0] &&
        startPointMobile.getLatLng().lng !==
        pathPolylinePoints[pathPolylinePoints.length - 1][1]
        ) {
        // check if marker not moving stop the loop
        if (isRestarting || isPaused) {
            if (mobileToAntennaLine) pathScreenGroup.removeLayer(mobileToAntennaLine);
            break;
        }
        // calculate dx and dy from startPointMobile to the next point
        let dx =
            pathPolylinePoints[currentCheckPointIndex + 1][0] - startPointMobile.getLatLng().lat;
        let dy =
            pathPolylinePoints[currentCheckPointIndex + 1][1] - startPointMobile.getLatLng().lng;

        // calculate the angle of the line
        let angle = Math.atan2(dy, dx);
        // calculate new lat and lng
        let newLat = startPointMobile.getLatLng().lat + avgSpeed * Math.cos(angle);
        let newLng = startPointMobile.getLatLng().lng + avgSpeed * Math.sin(angle);

        //check if the distance between current possition and the new possition is more than
        //the distance between the current possition and the next checkpoint
        let distanceBetweenInitialPosAndCheckpoint = Math.sqrt(
            Math.pow(
                startPointMobile.getLatLng().lat - pathPolylinePoints[currentCheckPointIndex + 1][0],
                2
            ) +
            Math.pow(
                startPointMobile.getLatLng().lng - pathPolylinePoints[currentCheckPointIndex + 1][1],
                2
            )
        );
        let distanceBetweenInitialPosAndNewPos = Math.sqrt(
            Math.pow(startPointMobile.getLatLng().lat - newLat, 2) +
            Math.pow(startPointMobile.getLatLng().lng - newLng, 2)
        );
        if (
            distanceBetweenInitialPosAndCheckpoint <
            distanceBetweenInitialPosAndNewPos
        ) {
            // move the marker to the next checkpoint
            startPointMobile.setLatLng([
                pathPolylinePoints[currentCheckPointIndex + 1][0],
                pathPolylinePoints[currentCheckPointIndex + 1][1],
            ]);
            //increase the currentCheckPointIndex
            currentCheckPointIndex++;
        } else {
            // move the mobile marker to new possition
            startPointMobile.setLatLng([newLat, newLng]);
        }

        // check where is the marker on cellHandoverMatrix
        let antennaIndex = getCellIndex(startPointMobile.getLatLng());
        if (antennaIndex !== -1) {
            // check if the line is already on the map and remove it
            if (mobileToAntennaLine) pathScreenGroup.removeLayer(mobileToAntennaLine);

            // create a line connecting the mobile to antenna
            let antennaPos = [antennas[antennaIndex].location.lat, antennas[antennaIndex].location.lng];
            mobileToAntennaLine = L.polyline([startPointMobile.getLatLng(), antennaPos], {color: 'red'});

            // add mobileToAntennaLine to pathScreenGroup
            pathScreenGroup.addLayer(mobileToAntennaLine);
        }
        if (antennaIndex === -1) {
            if (mobileToAntennaLine) pathScreenGroup.removeLayer(mobileToAntennaLine);
        }

        // delay the movement of the mobile marker
        await timer(100);
    }

    //check if the mobile marker is at the end of the path
    if (
        startPointMobile.getLatLng().lat ===
        pathPolylinePoints[pathPolylinePoints.length - 1][0] &&
        startPointMobile.getLatLng().lng ===
        pathPolylinePoints[pathPolylinePoints.length - 1][1]
    ) {
        // check if the line is already on the map and remove it
        if (mobileToAntennaLine) pathScreenGroup.removeLayer(mobileToAntennaLine);
        // show togglePauseMobileMovementButton
        togglePauseMobileMovementButton(false);
    }
}

async function pauseMobileMovement() {
    await timer(150);
    isPaused = !isPaused;
    if (!isPaused) {
        // continue moving the marker
        await moveMobile();
    }
}

//google.maps.event.addDomListener(window, 'load', initialize);

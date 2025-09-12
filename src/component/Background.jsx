// src/components/CesiumBackground.jsx
import React, { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

/**
 * CesiumRectBackground
 * - villages: array of village objects (lat/lon or latitude/longitude)
 * - rect: { west, south, east, north } (lon/lat degrees)
 * - onMarkerClick: optional function(url, village)
 */
export function CesiumRectBackground({ villages = [], rect = { west: 81.45, south: 22.45, east: 81.75, north: 22.70 }, onMarkerClick = null }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    if (viewerRef.current) return;

    const viewer = new Cesium.Viewer("cesiumRectContainer", {
      imageryProvider: new Cesium.OpenStreetMapImageryProvider({ url: "https://a.tile.openstreetmap.org/" }),
      baseLayerPicker: false,
      geocoder: false,
      timeline: false,
      animation: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      infoBox: false,
      selectionIndicator: false,
      fullscreenButton: false,
      vrButton: false,
      creditContainer: document.createElement("div"),
    });

    // fly to rectangle
    const sanctuaryRect = Cesium.Rectangle.fromDegrees(rect.west, rect.south, rect.east, rect.north);
    viewer.camera.flyTo({ destination: sanctuaryRect, duration: 1.2 });

    // camera constraints
    viewer.scene.screenSpaceCameraController.enableTranslate = false;
    viewer.scene.screenSpaceCameraController.enableRotate = true;
    viewer.scene.screenSpaceCameraController.enableTilt = true;
    viewer.scene.screenSpaceCameraController.enableLook = true;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 50.0;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 300000.0;

    // visual outline
    const outlinePositions = [
      Cesium.Cartographic.toCartesian(Cesium.Cartographic.fromDegrees(rect.west, rect.south)),
      Cesium.Cartographic.toCartesian(Cesium.Cartographic.fromDegrees(rect.east, rect.south)),
      Cesium.Cartographic.toCartesian(Cesium.Cartographic.fromDegrees(rect.east, rect.north)),
      Cesium.Cartographic.toCartesian(Cesium.Cartographic.fromDegrees(rect.west, rect.north)),
    ];

    viewer.entities.add({
      id: "sanctuary-rect-out",
      polygon: {
        hierarchy: outlinePositions,
        material: Cesium.Color.fromCssColorString("rgba(34,139,34,0.06)"),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString("rgba(34,139,34,0.9)"),
        outlineWidth: 2,
      },
    });

    viewerRef.current = viewer;

    return () => {
      try {
        if (viewerRef.current && !viewerRef.current.isDestroyed()) {
          viewerRef.current.destroy();
          viewerRef.current = null;
        }
      } catch (e) {}
    };
  }, [rect]);

  // markers + click handling
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // clear old markers
    const prev = viewer.entities.values.filter((e) => e && e.properties && e.properties._isVillageMarker);
    prev.forEach((e) => viewer.entities.remove(e));

    villages.forEach((v) => {
      const lat = v.lat ?? v.latitude ?? v.location?.lat;
      const lon = v.lon ?? v.longitude ?? v.location?.lng;
      if (typeof lat !== "number" || typeof lon !== "number") return;

      const ent = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        point: { pixelSize: 10, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, outlineWidth: 1 },
        label: { text: v.name ?? String(v.villageId ?? ""), font: "13px sans-serif", verticalOrigin: Cesium.VerticalOrigin.TOP, pixelOffset: new Cesium.Cartesian2(0, -16) },
        properties: { _isVillageMarker: true, url: v.url ?? `/villages/${encodeURIComponent(String(v.villageId))}`, _raw: v },
      });

      ent.point.color = Cesium.Color.ORANGE;
    });

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.position);
      if (Cesium.defined(picked) && picked.id && picked.id.properties && picked.id.properties._isVillageMarker) {
        const propUrl = picked.id.properties.url;
        const rawVillage = picked.id.properties._raw;
        const url = propUrl && (propUrl.getValue ? propUrl.getValue() : propUrl);
        if (typeof onMarkerClick === "function") onMarkerClick(url, rawVillage);
        else if (url) window.location.href = url;
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => handler && handler.destroy();
  }, [villages, onMarkerClick]);

  return <div id="cesiumRectContainer" ref={containerRef} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: -10 }} />;
}

/**
 * CesiumPolygonBackground
 * - polygonCoordinates: array of [lon, lat] pairs (outer ring) OR pass geoJson polygon via geoJson prop
 * - villages, onMarkerClick same as above
 */
export function CesiumPolygonBackground({ villages = [], polygonCoordinates = null, geoJson = null, onMarkerClick = null }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    if (viewerRef.current) return;

    const viewer = new Cesium.Viewer("cesiumPolyContainer", {
      imageryProvider: new Cesium.OpenStreetMapImageryProvider({ url: "https://a.tile.openstreetmap.org/" }),
      baseLayerPicker: false,
      geocoder: false,
      timeline: false,
      animation: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      infoBox: false,
      selectionIndicator: false,
      fullscreenButton: false,
      vrButton: false,
      creditContainer: document.createElement("div"),
    });

    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewerRef.current = viewer;

    return () => {
      try {
        if (viewerRef.current && !viewerRef.current.isDestroyed()) {
          viewerRef.current.destroy();
          viewerRef.current = null;
        }
      } catch (e) {}
    };
  }, []);

  // polygon and fit camera
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const old = viewer.entities.getById("sanctuary-poly");
    if (old) viewer.entities.remove(old);

    let coords = null;
    if (geoJson) {
      try {
        const geom = geoJson?.features?.[0]?.geometry || geoJson.geometry || geoJson;
        if (geom && geom.type === "Polygon") coords = geom.coordinates?.[0]; // [ [lon,lat], ... ]
      } catch (e) {}
    } else if (Array.isArray(polygonCoordinates)) {
      coords = polygonCoordinates; // expect [ [lon,lat], ... ]
    }

    if (!coords || coords.length < 3) {
      coords = [
        [81.45, 22.45],
        [81.75, 22.45],
        [81.75, 22.70],
        [81.45, 22.70],
        [81.45, 22.45],
      ];
    }

    const positions = coords.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat));
    viewer.entities.add({
      id: "sanctuary-poly",
      polygon: {
        hierarchy: positions,
        material: Cesium.Color.fromCssColorString("rgba(34,139,34,0.06)"),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString("rgba(34,139,34,0.95)"),
      },
    });

    // bounding rect
    const cartos = coords.map(([lon, lat]) => Cesium.Cartographic.fromDegrees(lon, lat));
    const lons = cartos.map((c) => c.longitude);
    const lats = cartos.map((c) => c.latitude);
    const west = Math.min(...lons);
    const east = Math.max(...lons);
    const south = Math.min(...lats);
    const north = Math.max(...lats);
    const rect = new Cesium.Rectangle(west, south, east, north);

    viewer.camera.flyTo({ destination: rect, duration: 1.2 });

    viewer.scene.screenSpaceCameraController.enableTranslate = false;
    viewer.scene.screenSpaceCameraController.enableRotate = true;
    viewer.scene.screenSpaceCameraController.enableTilt = true;
    viewer.scene.screenSpaceCameraController.enableLook = true;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 50.0;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 300000.0;
  }, [polygonCoordinates, geoJson]);

  // markers + clicks
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const prev = viewer.entities.values.filter((e) => e && e.properties && e.properties._isVillageMarker);
    prev.forEach((e) => viewer.entities.remove(e));

    villages.forEach((v) => {
      const lat = v.lat ?? v.latitude ?? v.location?.lat;
      const lon = v.lon ?? v.longitude ?? v.location?.lng;
      if (typeof lat !== "number" || typeof lon !== "number") return;

      const ent = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        point: { pixelSize: 10, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, outlineWidth: 1 },
        label: { text: v.name ?? String(v.villageId ?? ""), font: "13px sans-serif", verticalOrigin: Cesium.VerticalOrigin.TOP, pixelOffset: new Cesium.Cartesian2(0, -16) },
        properties: { _isVillageMarker: true, url: v.url ?? `/villages/${encodeURIComponent(String(v.villageId))}`, _raw: v },
      });

      ent.point.color = Cesium.Color.RED;
    });

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.position);
      if (Cesium.defined(picked) && picked.id && picked.id.properties && picked.id.properties._isVillageMarker) {
        const propUrl = picked.id.properties.url;
        const rawVillage = picked.id.properties._raw;
        const url = propUrl && (propUrl.getValue ? propUrl.getValue() : propUrl);
        if (typeof onMarkerClick === "function") onMarkerClick(url, rawVillage);
        else if (url) window.location.href = url;
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => handler && handler.destroy();
  }, [villages, onMarkerClick]);

  return <div id="cesiumPolyContainer" ref={containerRef} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: -10 }} />;
}

import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Restaurant } from "@/types/restaurant";
const mockMap = {
  getZoom: () => 13,
  getMaxZoom: () => 19,
  project: ([lat, lng]: number[]) => ({
    x: lat * 10000,
    y: lng * 10000,
    add: () => ({ x: lat, y: lng }),
  }),
  unproject: () => [32, 35],
  flyTo: jest.fn(),
  panTo: jest.fn(),
  fitBounds: jest.fn(),
  zoomIn: jest.fn(),
  zoomOut: jest.fn(),
};
const mockUseMapEvents = jest.fn(() => mockMap);
jest.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({
    title,
    eventHandlers,
    children,
  }: {
    title: string;
    eventHandlers: { click: () => void };
    children: React.ReactNode;
  }) => (
    <button data-testid="marker" title={title} onClick={eventHandlers.click}>
      {children}
    </button>
  ),
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
  useMap: () => mockMap,
  useMapEvents: () => mockUseMapEvents(),
}));
jest.mock("leaflet", () => ({
  divIcon: jest.fn(() => ({})),
  latLngBounds: jest.fn(() => ({})),
}));
jest.mock("../UserLocationMarker", () => ({ UserLocationMarker: () => null }));
import MapView from "../MapView";
const make = (id: string, lat = 32): Restaurant => ({
  id,
  name_hebrew: `מסעדה ${id}`,
  location: {
    lat,
    lng: 35,
    city: null,
    neighborhood: null,
    address: null,
    region: null,
  },
});
beforeEach(() => jest.clearAllMocks());
it("renders separated pins without Leaflet popups", () => {
  const select = jest.fn();
  render(
    <MapView restaurants={[make("a"), make("b", 33)]} onMarkerClick={select} />,
  );
  expect(screen.getAllByTestId("marker")).toHaveLength(2);
  fireEvent.click(screen.getByTitle("מסעדה a"));
  expect(select).toHaveBeenCalledWith("a");
});
it("groups close pins and zooms on cluster click", () => {
  render(<MapView restaurants={[make("a"), make("b", 32.0001)]} />);
  expect(screen.getAllByTestId("marker")).toHaveLength(1);
  fireEvent.click(screen.getByTitle("2 מסעדות, לחצו להתקרבות"));
  expect(mockMap.fitBounds).toHaveBeenCalled();
});
it("supports empty map, explicit location permission and zoom controls", () => {
  const locate = jest.fn();
  render(<MapView restaurants={[]} onLocateMe={locate} />);
  expect(screen.queryAllByTestId("marker")).toHaveLength(0);
  expect(locate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText("המיקום שלי"));
  fireEvent.click(screen.getByLabelText("התקרבות"));
  expect(locate).toHaveBeenCalledTimes(1);
  expect(mockMap.zoomIn).toHaveBeenCalledTimes(1);
});
it("lists coincident restaurants when maximum zoom cannot split them", () => {
  const selectCluster = jest.fn();
  mockUseMapEvents.mockReturnValueOnce({ ...mockMap, getZoom: () => 19 });
  render(
    <MapView
      restaurants={[make("a"), make("b")]}
      onClusterSelect={selectCluster}
    />,
  );
  fireEvent.click(screen.getByTitle("2 מסעדות, לחצו להתקרבות"));
  expect(selectCluster).toHaveBeenCalledWith([make("a"), make("b")]);
});

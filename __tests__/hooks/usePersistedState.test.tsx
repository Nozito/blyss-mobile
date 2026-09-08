import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePersistedState } from "@/hooks/usePersistedState";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const KEY = "pro_calendar_view_mode";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("usePersistedState", () => {
  it("rend la valeur initiale immédiatement, hydrated=false", () => {
    (AsyncStorage.getItem as jest.Mock).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePersistedState<"month" | "week">(KEY, "month"));
    expect(result.current[0]).toBe("month");
    expect(result.current[2]).toBe(false);
  });

  it("garde l'initiale et passe hydrated=true si rien n'est stocké", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const { result } = renderHook(() => usePersistedState<"month" | "week">(KEY, "month"));
    await waitFor(() => expect(result.current[2]).toBe(true));
    expect(result.current[0]).toBe("month");
  });

  it("réhydrate avec la valeur stockée", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("week");
    const { result } = renderHook(() => usePersistedState<"month" | "week">(KEY, "month"));
    await waitFor(() => expect(result.current[0]).toBe("week"));
    expect(result.current[2]).toBe(true);
  });

  it("set() met à jour la valeur et écrit dans AsyncStorage", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const { result } = renderHook(() => usePersistedState<"month" | "week">(KEY, "month"));
    await waitFor(() => expect(result.current[2]).toBe(true));

    act(() => result.current[1]("week"));

    expect(result.current[0]).toBe("week");
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(KEY, "week");
  });

  it("ne plante pas si AsyncStorage.getItem échoue, hydrated=true, valeur = initiale", async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error("disk"));
    const { result } = renderHook(() => usePersistedState<"month" | "week">(KEY, "month"));
    await waitFor(() => expect(result.current[2]).toBe(true));
    expect(result.current[0]).toBe("month");
  });
});

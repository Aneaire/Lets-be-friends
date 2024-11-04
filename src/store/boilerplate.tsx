import { create } from "zustand";
import { persist } from "zustand/middleware";

// Simple sample at the end

// 1. Define your store's state interface
interface StoreState {
  // State properties
  counter: number;
  name: string;
  isLoading: boolean;

  // Actions
  increment: () => void;
  decrement: () => void;
  setName: (name: string) => void;
  reset: () => void;
}

// 2. Define initial state
const initialState = {
  counter: 0,
  name: "",
  isLoading: false,
};

// 3. Create your store
export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // Initial state
      ...initialState,

      // Actions
      increment: () =>
        set((state) => ({
          counter: state.counter + 1,
        })),

      decrement: () =>
        set((state) => ({
          counter: state.counter - 1,
        })),

      setName: (name: string) => set({ name }),

      reset: () => set(initialState),
    }),
    {
      name: "store-storage", // unique name for localStorage key
      // Optional: Specify which state properties to persist
      partialize: (state) => ({
        counter: state.counter,
        name: state.name,
      }),
    }
  )
);

// 4. Optional: Create selector hooks for specific state values
export const useCounter = () => useStore((state) => state.counter);
export const useName = () => useStore((state) => state.name);

// 5. Optional: Create actions object for use outside components
export const storeActions = {
  increment: () => useStore.getState().increment(),
  decrement: () => useStore.getState().decrement(),
  setName: (name: string) => useStore.getState().setName(name),
  reset: () => useStore.getState().reset(),
};

// In React Components

function Counter() {
  // Use the whole store
  const { counter, increment, decrement } = useStore();

  // Or use individual selectors for better performance
  // const counter = useCounter()
  // const name = useName()

  return (
    <div>
      <p>Count: {counter}</p>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
  );
}

// Outside Components:
// In regular functions
function someFunction() {
  // Get current state
  const currentState = useStore.getState();

  // Dispatch actions
  storeActions.increment();
  storeActions.setName("New Name");
}

// Subscribe to Store Changes:
// Subscribe to store changes
const unsubscribe = useStore.subscribe((state) => {
  console.log("New state:", state);
});

// Unsubscribe when done
unsubscribe();

// Example of Adding a New Slice (for larger applications):
// Define slice state and actions
// interface TodoSlice {
//   todos: string[]
//   addTodo: (todo: string) => void
//   removeTodo: (index: number) => void
// }

// // Create the slice
// const createTodoSlice = (set) => ({
//   todos: [],
//   addTodo: (todo: string) =>
//     set((state) => ({
//       todos: [...state.todos, todo]
//     })),
//   removeTodo: (index: number) =>
//     set((state) => ({
//       todos: state.todos.filter((_, i) => i !== index)
//     })),
// })

// // Combine with main store
// const useStore = create<StoreState & TodoSlice>()(
//   persist(
//     (set, get) => ({
//       ...createTodoSlice(set),
//       // ... other store properties
//     }),
//     { name: 'store-storage' }
//   )
// )

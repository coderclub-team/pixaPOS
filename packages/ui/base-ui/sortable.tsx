"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  type DndContextProps,
  type DragEndEvent,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";

import { useComposedRefs } from "../lib/compose-refs";
import { cn } from "../lib/utils";

const ROOT_NAME = "SortableList";
const ITEM_NAME = "SortableItem";
const HANDLE_NAME = "SortableItemHandle";

interface SortableListContextValue {
  activeId: UniqueIdentifier | null;
}

const SortableListContext = React.createContext<SortableListContextValue | null>(null);

function useSortableList(consumerName: string) {
  const context = React.useContext(SortableListContext);
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ROOT_NAME}\``);
  }
  return context;
}

interface SortableItemContextValue {
  id: string;
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
  setActivatorNodeRef: (node: HTMLElement | null) => void;
  isDragging: boolean;
  disabled: boolean;
}

const SortableItemContext = React.createContext<SortableItemContextValue | null>(null);

function useSortableItem(consumerName: string) {
  const context = React.useContext(SortableItemContext);
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ITEM_NAME}\``);
  }
  return context;
}

interface GetItemValue<T> {
  getItemValue?: (item: T) => UniqueIdentifier;
}

type SortableListProps<T> = Omit<DndContextProps, "collisionDetection"> &
  (T extends object ? GetItemValue<T> : Partial<GetItemValue<T>>) & {
    value: T[];
    onValueChange?: (items: T[]) => void;
    onReorder?: (event: DragEndEvent & { activeIndex: number; overIndex: number }) => void;
  };

function SortableList<T>(props: SortableListProps<T>) {
  const {
    value,
    onValueChange,
    onReorder,
    getItemValue: getItemValueProp,
    accessibility,
    ...dndProps
  } = props;

  const [activeId, setActiveId] = React.useState<UniqueIdentifier | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const getItemValue = React.useCallback(
    (item: T): UniqueIdentifier => {
      if (typeof item === "object" && !getItemValueProp) {
        throw new Error("`getItemValue` is required when using array of objects");
      }
      return getItemValueProp ? getItemValueProp(item) : (item as unknown as UniqueIdentifier);
    },
    [getItemValueProp],
  );

  const onDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      dndProps.onDragEnd?.(event);
      setActiveId(null);

      const { active, over } = event;
      if (!over) return;

      const activeIndex = value.findIndex((item) => getItemValue(item) === active.id);
      const overIndex = value.findIndex((item) => getItemValue(item) === over.id);
      if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) return;

      const newItems = arrayMove(value, activeIndex, overIndex);
      if (onReorder) {
        onReorder({ ...event, activeIndex, overIndex });
      } else {
        onValueChange?.(newItems);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dndProps is unstable object ref
    [dndProps.onDragEnd, value, getItemValue, onReorder, onValueChange],
  );

  const contextValue = React.useMemo<SortableListContextValue>(() => ({ activeId }), [activeId]);

  const itemIds = React.useMemo(
    () => value.map((item) => getItemValue(item)),
    [value, getItemValue],
  );

  const { children, ...restDndProps } = dndProps as DndContextProps & {
    children?: React.ReactNode;
  };

  return (
    <SortableListContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        accessibility={
          {
            screenReaderInstructions: {
              draggable: `
                To pick up a sortable item, press space or enter.
                While dragging, use the arrow keys to move the item.
                Press space or enter again to drop the item in its new position, or press escape to cancel.
              `,
            },
            ...accessibility,
          } as never
        }
        {...restDndProps}
        onDragStart={(event) => {
          restDndProps.onDragStart?.(event);
          setActiveId(event.active.id);
        }}
        onDragEnd={onDragEnd}
        onDragCancel={(event) => {
          restDndProps.onDragCancel?.(event);
          setActiveId(null);
        }}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {children}
        </SortableContext>
      </DndContext>
    </SortableListContext.Provider>
  );
}

interface SortableItemProps extends React.ComponentProps<"div"> {
  value: UniqueIdentifier;
  render?: useRender.RenderProp;
  disabled?: boolean;
}

const SortableItem = React.forwardRef<HTMLDivElement, SortableItemProps>((props, ref) => {
  const { value, style, className, render, disabled, ...itemProps } = props;
  const id = React.useId();
  const { activeId } = useSortableList(ITEM_NAME);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: value, disabled });

  const composedRef = useComposedRefs(ref, (node) => {
    if (disabled) return;
    setNodeRef(node);
  });

  const composedStyle = React.useMemo<React.CSSProperties>(() => {
    return {
      transform: CSS.Transform.toString(transform),
      transition,
      ...style,
    };
  }, [transform, transition, style]);

  const itemContext = React.useMemo(
    () => ({ id, attributes, listeners, setActivatorNodeRef, isDragging, disabled }),
    [id, attributes, listeners, setActivatorNodeRef, isDragging, disabled],
  );

  const item = useRender({
    defaultTagName: "div",
    render,
    ref: composedRef,
    props: mergeProps<"div">(
      {
        id,
        "data-disabled": disabled,
        "data-dragging": isDragging ? "" : undefined,
      } as React.ComponentProps<"div">,
      itemProps,
      {
        style: composedStyle,
        className: cn(
          {
            relative: true,
            "opacity-70": isDragging && activeId === value,
            "pointer-events-none opacity-50": disabled,
          },
          className,
        ),
      },
    ),
  });

  return <SortableItemContext.Provider value={itemContext}>{item}</SortableItemContext.Provider>;
});
SortableItem.displayName = "SortableItem";

interface SortableItemHandleProps extends React.ComponentProps<"button"> {
  render?: useRender.RenderProp;
}

const SortableItemHandle = React.forwardRef<HTMLButtonElement, SortableItemHandleProps>(
  (props, ref) => {
    const { render, disabled, className, ...handleProps } = props;
    const itemContext = useSortableItem(ITEM_NAME);
    const { activeId } = useSortableList(HANDLE_NAME);

    const isDisabled = disabled ?? itemContext.disabled;

    const composedRef = useComposedRefs(ref, (node) => {
      if (isDisabled) return;
      itemContext.setActivatorNodeRef(node);
    });

    return useRender({
      defaultTagName: "button",
      render,
      ref: composedRef,
      props: mergeProps<"button">(
        {
          type: "button",
        } as React.ComponentProps<"button">,
        handleProps,
        isDisabled ? {} : { ...itemContext.attributes, ...itemContext.listeners },
        {
          className: cn(
            "select-none touch-none disabled:pointer-events-none disabled:opacity-50",
            { "cursor-grab": !isDisabled, "cursor-grabbing": itemContext.isDragging },
            className,
          ),
        },
        { disabled: isDisabled },
      ),
    });
  },
);
SortableItemHandle.displayName = "SortableItemHandle";

export { SortableList, SortableItem, SortableItemHandle };
export type { SortableListProps, SortableItemProps, SortableItemHandleProps };

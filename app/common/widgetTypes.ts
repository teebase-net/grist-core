/**
 * Exposes utilities for getting the types information associated to each of the widget types.
 */
import {StringUnion} from "app/common/StringUnion";

// Custom widgets that are attached to "Add New" menu.
// MOD DMH
// Added 'TabBar' to AttachedCustomWidgets to include it as a custom widget type
export const AttachedCustomWidgets = StringUnion('custom.calendar', 'TabBar');
// end MOD DMH
export type IAttachedCustomWidget = typeof AttachedCustomWidgets.type;

// all widget types
// MOD DMH
// Added 'TabBar' to IWidgetType union to support the new widget type
export type IWidgetType = 'record' | 'detail' | 'single' | 'chart' | 'custom' | 'form' | IAttachedCustomWidget | 'TabBar';
// end MOD DMH
export enum WidgetType {
  Table = 'record',
  Card = 'single',
  CardList = 'detail',
  Chart = 'chart',
  Custom = 'custom',
  Form = 'form',
  Calendar = 'custom.calendar',
  // MOD DMH
  // Added TabBar to WidgetType enum for consistency
  TabBar = 'TabBar',
  // end MOD DMH
}

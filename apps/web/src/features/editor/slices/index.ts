import { combineReducers } from '@reduxjs/toolkit';
import document from './documentSlice';
import tools from './toolsSlice';
import view from './viewSlice';
import save from './saveSlice';

export const editorReducer = combineReducers({ document, tools, view, save });

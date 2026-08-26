import { NgModule } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import {
    IconChartBar,
    IconUsers,
    IconChecklist,
    IconPlus,
    IconList,
    IconCalendarEvent,
    IconHourglassHigh,
    IconCircleCheck,
    IconArrowRight,
    IconEye,
    IconPencil,
    IconEdit
} from 'angular-tabler-icons/icons';

const icons = {
    IconChartBar,
    IconUsers,
    IconChecklist,
    IconPlus,
    IconList,
    IconCalendarEvent,
    IconHourglassHigh,
    IconCircleCheck,
    IconArrowRight,
    IconEye,
    IconPencil,
    IconEdit
};


@NgModule({
    imports: [
        TablerIconsModule.pick(icons)
    ],
    exports: [
        TablerIconsModule
    ]
})
export class IconsModule { }

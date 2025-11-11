import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { BoardService } from './board.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';

@Controller('api/v1/boards')
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Post()
  create(@Body() createBoardDto: CreateBoardDto) {
    // TODO: Get ownerId from auth token
    const ownerId = 1; // Replace with actual logic to get user ID from token
    return this.boardService.create(createBoardDto, ownerId);
  }

  @Get('templates')
  findTemplates() {
    return this.boardService.findTemplates();
  }

  @Get('mine')
  findMine() {
    // TODO: Get ownerId from auth token
    const ownerId = 1; // Replace with actual logic to get user ID from token
    return this.boardService.findMine(ownerId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.boardService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBoardDto: UpdateBoardDto,
  ) {
    return this.boardService.update(id, updateBoardDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.boardService.remove(id);
  }
}

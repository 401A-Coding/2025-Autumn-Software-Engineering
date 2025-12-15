import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CommunityService } from './community.service';
import { PostsQueryDto, PostCreateDto, PostPatchDto } from './dto/post.dto';
import { PostCommentsQueryDto, CommentCreateDto } from './dto/comment.dto';
import { ReportCreateDto } from './dto/report.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('api/v1/community')
export class CommunityController {
  constructor(private readonly service: CommunityService) {}

  @Get('posts')
  async listPosts(@Query() query: PostsQueryDto) {
    const data = await this.service.listPosts({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      q: query.q,
      tag: query.tag,
      type: query.type,
      authorId: query.authorId,
      sort: (query.sort as any) ?? 'new',
    });
    return { code: 0, message: 'success', data };
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts')
  async createPost(@Req() req: any, @Body() body: PostCreateDto) {
    const result = await this.service.createPost(req.user?.sub, body);
    return { code: 0, message: '创建成功', data: result };
  }

  @Get('posts/:postId')
  async getPost(@Param('postId') postId: string) {
    const post = await this.service.getPost(Number(postId));
    return { code: 0, message: 'success', data: post };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('posts/:postId')
  async updatePost(
    @Req() req: any,
    @Param('postId') postId: string,
    @Body() patch: PostPatchDto,
  ) {
    const post = await this.service.updatePost(
      req.user?.sub,
      Number(postId),
      patch,
    );
    return { code: 0, message: 'success', data: post };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('posts/:postId')
  async deletePost(@Req() req: any, @Param('postId') postId: string) {
    const result = await this.service.deletePost(req.user?.sub, Number(postId));
    return { code: 0, message: 'success', data: result };
  }

  @Get('posts/:postId/comments')
  async listComments(
    @Param('postId') postId: string,
    @Query() query: PostCommentsQueryDto,
  ) {
    const data = await this.service.listComments(
      Number(postId),
      query.page ?? 1,
      query.pageSize ?? 20,
    );
    return { code: 0, message: 'success', data };
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts/:postId/comments')
  async addComment(
    @Req() req: any,
    @Param('postId') postId: string,
    @Body() body: CommentCreateDto,
  ) {
    const data = await this.service.addComment(
      req.user?.sub,
      Number(postId),
      body,
    );
    return { code: 0, message: 'success', data };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('comments/:commentId')
  async deleteComment(@Req() req: any, @Param('commentId') commentId: string) {
    // TODO: ownership/moderation checks in service
    return { code: 0, message: 'success', data: { ok: true } };
  }

  @UseGuards(JwtAuthGuard)
  @Post('comments/:commentId/like')
  async likeComment(@Req() req: any, @Param('commentId') commentId: string) {
    const data = await this.service.likeComment(
      req.user?.sub,
      Number(commentId),
    );
    return { code: 0, message: 'success', data };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('comments/:commentId/like')
  async unlikeComment(
    @Req() req: any,
    @Param('commentId') commentId: string,
  ) {
    const data = await this.service.unlikeComment(
      req.user?.sub,
      Number(commentId),
    );
    return { code: 0, message: 'success', data };
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts/:postId/like')
  async likePost(@Req() req: any, @Param('postId') postId: string) {
    const data = await this.service.likePost(req.user?.sub, Number(postId));
    return { code: 0, message: 'success', data };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('posts/:postId/like')
  async unlikePost(@Req() req: any, @Param('postId') postId: string) {
    const data = await this.service.unlikePost(req.user?.sub, Number(postId));
    return { code: 0, message: 'success', data };
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts/:postId/bookmark')
  async bookmarkPost(@Req() req: any, @Param('postId') postId: string) {
    const data = await this.service.bookmarkPost(req.user?.sub, Number(postId));
    return { code: 0, message: 'success', data };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('posts/:postId/bookmark')
  async unbookmarkPost(@Req() req: any, @Param('postId') postId: string) {
    const data = await this.service.unbookmarkPost(
      req.user?.sub,
      Number(postId),
    );
    return { code: 0, message: 'success', data };
  }

  @UseGuards(JwtAuthGuard)
  @Post('reports')
  async createReport(@Req() req: any, @Body() body: ReportCreateDto) {
    const data = await this.service.createReport(req.user?.sub, body);
    return { code: 0, message: '已受理', data };
  }

  @Get('search')
  async search(
    @Query('q') q?: string,
    @Query('tag') tag?: string,
    @Query('type') type?: string,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 10,
  ) {
    const data = await this.service.search({
      q,
      tag,
      type,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 10,
    });
    return { code: 0, message: 'success', data };
  }
}
